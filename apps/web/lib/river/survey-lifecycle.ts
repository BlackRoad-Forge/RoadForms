import "server-only";
import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  RIVER_INSERT_NOTIFICATION_CHANNEL,
  RIVER_PENDING_JOB_STATES,
  RIVER_SCHEMA,
  RIVER_SURVEY_END_KIND,
  RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS,
  RIVER_SURVEY_LIFECYCLE_QUEUE,
  RIVER_SURVEY_START_KIND,
} from "./constants";

export type SurveyLifecycleJobKind = typeof RIVER_SURVEY_START_KIND | typeof RIVER_SURVEY_END_KIND;

export interface SurveyLifecycleJobArgs {
  surveyId: string;
  environmentId: string;
  scheduledFor: string;
}

export interface SurveyLifecycleSurvey {
  id: TSurvey["id"];
  environmentId: TSurvey["environmentId"];
  startsAt?: TSurvey["startsAt"];
  endsAt?: TSurvey["endsAt"];
}

interface EnqueueSurveyLifecycleJobsOptions {
  tx: Prisma.TransactionClient;
  survey: SurveyLifecycleSurvey;
  previousSurvey?: Pick<SurveyLifecycleSurvey, "startsAt" | "endsAt"> | null;
  now?: Date;
  schema?: string;
}

interface DeleteSurveyLifecycleJobsOptions {
  tx: Prisma.TransactionClient;
  surveyId: string;
  schema?: string;
  kinds?: SurveyLifecycleJobKind[];
}

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (identifier: string): string => {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
};

const getQualifiedRiverJobTable = (schema: string): Prisma.Sql =>
  Prisma.raw(`${quoteIdentifier(schema)}.${quoteIdentifier("river_job")}`);

const getQualifiedInsertNotificationChannel = (schema: string): string => {
  if (!identifierPattern.test(schema)) {
    throw new Error(`Invalid SQL identifier: ${schema}`);
  }

  return `${schema}.${RIVER_INSERT_NOTIFICATION_CHANNEL}`;
};

const shouldEnqueueTransition = (previousValue?: Date | null, nextValue?: Date | null): nextValue is Date =>
  previousValue == null && nextValue != null;

const buildJobArgs = (survey: SurveyLifecycleSurvey, scheduledFor: Date): SurveyLifecycleJobArgs => ({
  surveyId: survey.id,
  environmentId: survey.environmentId,
  scheduledFor: scheduledFor.toISOString(),
});

const enqueueLifecycleJob = async (
  tx: Prisma.TransactionClient,
  {
    kind,
    survey,
    scheduledFor,
    schema,
    now,
  }: {
    kind: SurveyLifecycleJobKind;
    survey: SurveyLifecycleSurvey;
    scheduledFor: Date;
    schema: string;
    now: Date;
  }
): Promise<void> => {
  const args = JSON.stringify(buildJobArgs(survey, scheduledFor));
  const riverJobTable = getQualifiedRiverJobTable(schema);

  if (scheduledFor.getTime() > now.getTime()) {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO ${riverJobTable} (args, kind, max_attempts, queue, scheduled_at)
        VALUES (
          ${args}::jsonb,
          ${kind},
          ${RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS},
          ${RIVER_SURVEY_LIFECYCLE_QUEUE},
          ${scheduledFor}
        )
      `
    );
  } else {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO ${riverJobTable} (args, kind, max_attempts, queue)
        VALUES (
          ${args}::jsonb,
          ${kind},
          ${RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS},
          ${RIVER_SURVEY_LIFECYCLE_QUEUE}
        )
      `
    );
  }
};

const notifyLifecycleQueue = async (tx: Prisma.TransactionClient, schema: string): Promise<void> => {
  const payload = JSON.stringify({ queue: RIVER_SURVEY_LIFECYCLE_QUEUE });
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_notify(${getQualifiedInsertNotificationChannel(schema)}, ${payload})`
  );
};

export const enqueueSurveyLifecycleJobs = async ({
  tx,
  survey,
  previousSurvey,
  now = new Date(),
  schema = RIVER_SCHEMA,
}: EnqueueSurveyLifecycleJobsOptions): Promise<void> => {
  const pendingJobs: Array<{ kind: SurveyLifecycleJobKind; scheduledFor: Date }> = [];

  if (shouldEnqueueTransition(previousSurvey?.startsAt ?? null, survey.startsAt ?? null)) {
    pendingJobs.push({ kind: RIVER_SURVEY_START_KIND, scheduledFor: survey.startsAt as Date });
  }

  if (shouldEnqueueTransition(previousSurvey?.endsAt ?? null, survey.endsAt ?? null)) {
    pendingJobs.push({ kind: RIVER_SURVEY_END_KIND, scheduledFor: survey.endsAt as Date });
  }

  if (pendingJobs.length === 0) {
    return;
  }

  try {
    for (const job of pendingJobs) {
      await enqueueLifecycleJob(tx, { ...job, survey, schema, now });
    }

    await notifyLifecycleQueue(tx, schema);
  } catch (error) {
    logger.error({ error, surveyId: survey.id }, "Failed to enqueue survey lifecycle jobs");
    throw error;
  }
};

export const deleteSurveyLifecycleJobs = async ({
  tx,
  surveyId,
  schema = RIVER_SCHEMA,
  kinds = [RIVER_SURVEY_START_KIND, RIVER_SURVEY_END_KIND],
}: DeleteSurveyLifecycleJobsOptions): Promise<void> => {
  try {
    await tx.$executeRaw(
      Prisma.sql`
        DELETE FROM ${getQualifiedRiverJobTable(schema)}
        WHERE kind IN (${Prisma.join(kinds)})
          AND args->>'surveyId' = ${surveyId}
          AND state IN (${Prisma.join(RIVER_PENDING_JOB_STATES)})
      `
    );
  } catch (error) {
    logger.error({ error, surveyId }, "Failed to delete pending survey lifecycle jobs");
    throw error;
  }
};
