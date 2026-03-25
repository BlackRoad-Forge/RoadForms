import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  INNGEST_SURVEY_END_CANCELLED_EVENT,
  INNGEST_SURVEY_END_EVENT,
  INNGEST_SURVEY_START_CANCELLED_EVENT,
  INNGEST_SURVEY_START_EVENT,
} from "./constants";
import {
  getSurveyLifecycleCancellationEvents,
  getSurveyLifecycleEvents,
  publishSurveyLifecycleCancellationEvents,
  publishSurveyLifecycleEvents,
} from "./survey-lifecycle";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("survey lifecycle inngest events", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockReset();
  });

  test("builds a start event when startsAt is set on create", () => {
    const startsAt = new Date("2026-04-01T12:00:00.000Z");

    expect(
      getSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt,
          endsAt: null,
        },
        now: new Date("2026-03-31T12:00:00.000Z"),
      })
    ).toEqual([
      {
        name: INNGEST_SURVEY_START_EVENT,
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
          scheduledFor: startsAt.toISOString(),
        },
        ts: startsAt.getTime(),
      },
    ]);
  });

  test("builds an end event when endsAt is set on create", () => {
    const endsAt = new Date("2026-04-02T12:00:00.000Z");

    expect(
      getSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt: null,
          endsAt,
        },
        now: new Date("2026-03-31T12:00:00.000Z"),
      })
    ).toEqual([
      {
        name: INNGEST_SURVEY_END_EVENT,
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
          scheduledFor: endsAt.toISOString(),
        },
        ts: endsAt.getTime(),
      },
    ]);
  });

  test("builds both lifecycle events when both dates are set on create", () => {
    const startsAt = new Date("2026-04-01T12:00:00.000Z");
    const endsAt = new Date("2026-04-02T12:00:00.000Z");

    const events = getSurveyLifecycleEvents({
      survey: {
        id: "survey_1",
        environmentId: "env_1",
        startsAt,
        endsAt,
      },
      now: new Date("2026-03-31T12:00:00.000Z"),
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.name).toBe(INNGEST_SURVEY_START_EVENT);
    expect(events[1]?.name).toBe(INNGEST_SURVEY_END_EVENT);
  });

  test("does nothing when neither lifecycle date is set", () => {
    expect(
      getSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt: null,
          endsAt: null,
        },
      })
    ).toEqual([]);
  });

  test("builds a lifecycle event when a date transitions from null to a value", () => {
    const startsAt = new Date("2026-04-01T12:00:00.000Z");

    expect(
      getSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt,
          endsAt: null,
        },
        previousSurvey: {
          startsAt: null,
          endsAt: null,
        },
        now: new Date("2026-03-31T12:00:00.000Z"),
      })
    ).toHaveLength(1);
  });

  test("does not build events when a lifecycle date changes after already being set", () => {
    expect(
      getSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt: new Date("2026-04-02T12:00:00.000Z"),
          endsAt: null,
        },
        previousSurvey: {
          startsAt: new Date("2026-04-01T12:00:00.000Z"),
          endsAt: null,
        },
      })
    ).toEqual([]);
  });

  test("does not build events when a lifecycle date is cleared", () => {
    expect(
      getSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt: null,
          endsAt: null,
        },
        previousSurvey: {
          startsAt: new Date("2026-04-01T12:00:00.000Z"),
          endsAt: null,
        },
      })
    ).toEqual([]);
  });

  test("publishes immediate events without a scheduled timestamp when the date is in the past", async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    const startsAt = new Date("2026-03-30T12:00:00.000Z");

    await publishSurveyLifecycleEvents({
      survey: {
        id: "survey_1",
        environmentId: "env_1",
        startsAt,
        endsAt: null,
      },
      now: new Date("2026-03-31T12:00:00.000Z"),
      sender,
    });

    expect(sender).toHaveBeenCalledWith([
      {
        name: INNGEST_SURVEY_START_EVENT,
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
          scheduledFor: startsAt.toISOString(),
        },
      },
    ]);
  });

  test("builds lifecycle cancellation events for survey deletion", () => {
    expect(
      getSurveyLifecycleCancellationEvents({
        surveyId: "survey_1",
        environmentId: "env_1",
      })
    ).toEqual([
      {
        name: INNGEST_SURVEY_START_CANCELLED_EVENT,
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
        },
      },
      {
        name: INNGEST_SURVEY_END_CANCELLED_EVENT,
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
        },
      },
    ]);
  });

  test("logs and rethrows publish failures", async () => {
    const sender = vi.fn().mockRejectedValue(new Error("send failed"));

    await expect(
      publishSurveyLifecycleEvents({
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt: new Date("2026-04-01T12:00:00.000Z"),
          endsAt: null,
        },
        sender,
      })
    ).rejects.toThrow("send failed");

    expect(logger.error).toHaveBeenCalledWith(
      {
        error: expect.any(Error),
        surveyId: "survey_1",
      },
      "Failed to publish survey lifecycle events"
    );
  });

  test("logs and rethrows cancellation publish failures", async () => {
    const sender = vi.fn().mockRejectedValue(new Error("cancel failed"));

    await expect(
      publishSurveyLifecycleCancellationEvents({
        surveyId: "survey_1",
        environmentId: "env_1",
        sender,
      })
    ).rejects.toThrow("cancel failed");

    expect(logger.error).toHaveBeenCalledWith(
      {
        error: expect.any(Error),
        surveyId: "survey_1",
      },
      "Failed to publish survey lifecycle cancellation events"
    );
  });
});
