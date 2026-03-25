import "server-only";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type InngestSendableEvent, sendInngestEvents } from "./client";
import {
  INNGEST_SURVEY_END_CANCELLED_EVENT,
  INNGEST_SURVEY_END_EVENT,
  INNGEST_SURVEY_START_CANCELLED_EVENT,
  INNGEST_SURVEY_START_EVENT,
} from "./constants";

interface SurveyLifecycleSurvey {
  id: TSurvey["id"];
  environmentId: TSurvey["environmentId"];
  startsAt?: TSurvey["startsAt"];
  endsAt?: TSurvey["endsAt"];
}

interface PublishSurveyLifecycleEventsOptions {
  survey: SurveyLifecycleSurvey;
  previousSurvey?: Pick<SurveyLifecycleSurvey, "startsAt" | "endsAt"> | null;
  now?: Date;
  sender?: (events: InngestSendableEvent[]) => Promise<unknown>;
}

interface PublishSurveyLifecycleCancellationEventsOptions {
  surveyId: string;
  environmentId: string;
  sender?: (events: InngestSendableEvent[]) => Promise<unknown>;
}

const shouldPublishTransition = (previousValue?: Date | null, nextValue?: Date | null): nextValue is Date =>
  previousValue == null && nextValue != null;

const buildScheduledEvent = (
  name: string,
  survey: SurveyLifecycleSurvey,
  scheduledFor: Date,
  now: Date
): InngestSendableEvent => ({
  name,
  data: {
    surveyId: survey.id,
    environmentId: survey.environmentId,
    scheduledFor: scheduledFor.toISOString(),
  },
  ...(scheduledFor.getTime() > now.getTime() ? { ts: scheduledFor.getTime() } : {}),
});

export const getSurveyLifecycleEvents = ({
  survey,
  previousSurvey,
  now = new Date(),
}: Omit<PublishSurveyLifecycleEventsOptions, "sender">): InngestSendableEvent[] => {
  const events: InngestSendableEvent[] = [];

  if (shouldPublishTransition(previousSurvey?.startsAt ?? null, survey.startsAt ?? null)) {
    events.push(buildScheduledEvent(INNGEST_SURVEY_START_EVENT, survey, survey.startsAt, now));
  }

  if (shouldPublishTransition(previousSurvey?.endsAt ?? null, survey.endsAt ?? null)) {
    events.push(buildScheduledEvent(INNGEST_SURVEY_END_EVENT, survey, survey.endsAt, now));
  }

  return events;
};

export const publishSurveyLifecycleEvents = async ({
  survey,
  previousSurvey,
  now = new Date(),
  sender = sendInngestEvents,
}: PublishSurveyLifecycleEventsOptions): Promise<void> => {
  const events = getSurveyLifecycleEvents({ survey, previousSurvey, now });

  if (events.length === 0) {
    return;
  }

  try {
    await sender(events);
  } catch (error) {
    logger.error({ error, surveyId: survey.id }, "Failed to publish survey lifecycle events");
    throw error;
  }
};

export const getSurveyLifecycleCancellationEvents = ({
  surveyId,
  environmentId,
}: Omit<PublishSurveyLifecycleCancellationEventsOptions, "sender">): InngestSendableEvent[] => [
  {
    name: INNGEST_SURVEY_START_CANCELLED_EVENT,
    data: {
      surveyId,
      environmentId,
    },
  },
  {
    name: INNGEST_SURVEY_END_CANCELLED_EVENT,
    data: {
      surveyId,
      environmentId,
    },
  },
];

export const publishSurveyLifecycleCancellationEvents = async ({
  surveyId,
  environmentId,
  sender = sendInngestEvents,
}: PublishSurveyLifecycleCancellationEventsOptions): Promise<void> => {
  try {
    await sender(getSurveyLifecycleCancellationEvents({ surveyId, environmentId }));
  } catch (error) {
    logger.error({ error, surveyId }, "Failed to publish survey lifecycle cancellation events");
    throw error;
  }
};
