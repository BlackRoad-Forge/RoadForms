import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { Socket } from "net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  RIVER_INSERT_NOTIFICATION_CHANNEL,
  RIVER_PENDING_JOB_STATES,
  RIVER_SURVEY_END_KIND,
  RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS,
  RIVER_SURVEY_LIFECYCLE_QUEUE,
  RIVER_SURVEY_START_KIND,
} from "./constants";
import { deleteSurveyLifecycleJobs, enqueueSurveyLifecycleJobs } from "./survey-lifecycle";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const createMockTx = () =>
  ({
    $executeRaw: vi.fn(),
  }) as unknown as Prisma.TransactionClient;

const getQueryValues = (callIndex: number, tx: Prisma.TransactionClient) => {
  const query = vi.mocked(tx.$executeRaw).mock.calls[callIndex][0] as Prisma.Sql;
  return query.values;
};

describe("enqueueSurveyLifecycleJobs", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockReset();
  });

  test("enqueues a start job when startsAt is set on create", async () => {
    const tx = createMockTx();
    const startsAt = new Date("2026-04-01T12:00:00.000Z");

    await enqueueSurveyLifecycleJobs({
      tx,
      now: new Date("2026-03-31T12:00:00.000Z"),
      survey: {
        id: "survey_1",
        environmentId: "env_1",
        startsAt,
        endsAt: null,
      },
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(getQueryValues(0, tx)).toEqual([
      JSON.stringify({
        surveyId: "survey_1",
        environmentId: "env_1",
        scheduledFor: startsAt.toISOString(),
      }),
      RIVER_SURVEY_START_KIND,
      RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS,
      RIVER_SURVEY_LIFECYCLE_QUEUE,
      startsAt,
    ]);
    expect(getQueryValues(1, tx)).toEqual([
      `river.${RIVER_INSERT_NOTIFICATION_CHANNEL}`,
      JSON.stringify({ queue: RIVER_SURVEY_LIFECYCLE_QUEUE }),
    ]);
  });

  test("enqueues an end job when endsAt is set on create", async () => {
    const tx = createMockTx();
    const endsAt = new Date("2026-04-02T12:00:00.000Z");

    await enqueueSurveyLifecycleJobs({
      tx,
      now: new Date("2026-03-31T12:00:00.000Z"),
      survey: {
        id: "survey_1",
        environmentId: "env_1",
        startsAt: null,
        endsAt,
      },
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(getQueryValues(0, tx)).toEqual([
      JSON.stringify({
        surveyId: "survey_1",
        environmentId: "env_1",
        scheduledFor: endsAt.toISOString(),
      }),
      RIVER_SURVEY_END_KIND,
      RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS,
      RIVER_SURVEY_LIFECYCLE_QUEUE,
      endsAt,
    ]);
  });

  test("enqueues both lifecycle jobs when both dates are set on create", async () => {
    const tx = createMockTx();
    const startsAt = new Date("2026-04-01T12:00:00.000Z");
    const endsAt = new Date("2026-04-02T12:00:00.000Z");

    await enqueueSurveyLifecycleJobs({
      tx,
      now: new Date("2026-03-31T12:00:00.000Z"),
      survey: {
        id: "survey_1",
        environmentId: "env_1",
        startsAt,
        endsAt,
      },
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
    expect(getQueryValues(0, tx)[1]).toBe(RIVER_SURVEY_START_KIND);
    expect(getQueryValues(1, tx)[1]).toBe(RIVER_SURVEY_END_KIND);
  });

  test("does nothing when neither lifecycle date is set", async () => {
    const tx = createMockTx();

    await enqueueSurveyLifecycleJobs({
      tx,
      survey: {
        id: "survey_1",
        environmentId: "env_1",
        startsAt: null,
        endsAt: null,
      },
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  test("enqueues a lifecycle job when a date transitions from null to a value", async () => {
    const tx = createMockTx();
    const startsAt = new Date("2026-04-01T12:00:00.000Z");

    await enqueueSurveyLifecycleJobs({
      tx,
      now: new Date("2026-03-31T12:00:00.000Z"),
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
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });

  test("does not enqueue when a lifecycle date changes after already being set", async () => {
    const tx = createMockTx();

    await enqueueSurveyLifecycleJobs({
      tx,
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
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  test("does not enqueue when a lifecycle date is cleared", async () => {
    const tx = createMockTx();

    await enqueueSurveyLifecycleJobs({
      tx,
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
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  test("logs and rethrows SQL errors", async () => {
    const tx = createMockTx();
    const queryError = new Error("insert failed");
    vi.mocked(tx.$executeRaw).mockRejectedValueOnce(queryError);

    await expect(
      enqueueSurveyLifecycleJobs({
        tx,
        survey: {
          id: "survey_1",
          environmentId: "env_1",
          startsAt: new Date("2026-04-01T12:00:00.000Z"),
          endsAt: null,
        },
      })
    ).rejects.toThrow(queryError);

    expect(logger.error).toHaveBeenCalledWith(
      { error: queryError, surveyId: "survey_1" },
      "Failed to enqueue survey lifecycle jobs"
    );
  });
});

describe("deleteSurveyLifecycleJobs", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockReset();
  });

  test("deletes pending lifecycle jobs for the survey", async () => {
    const tx = createMockTx();

    await deleteSurveyLifecycleJobs({
      tx,
      surveyId: "survey_1",
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(getQueryValues(0, tx)).toEqual([
      RIVER_SURVEY_START_KIND,
      RIVER_SURVEY_END_KIND,
      "survey_1",
      ...RIVER_PENDING_JOB_STATES,
    ]);
  });

  test("logs and rethrows delete failures", async () => {
    const tx = createMockTx();
    const queryError = new Error("delete failed");
    vi.mocked(tx.$executeRaw).mockRejectedValueOnce(queryError);

    await expect(
      deleteSurveyLifecycleJobs({
        tx,
        surveyId: "survey_1",
      })
    ).rejects.toThrow(queryError);

    expect(logger.error).toHaveBeenCalledWith(
      { error: queryError, surveyId: "survey_1" },
      "Failed to delete pending survey lifecycle jobs"
    );
  });
});

const canReachPostgres = async (databaseURL?: string): Promise<boolean> => {
  if (!databaseURL) {
    return false;
  }

  try {
    const parsedURL = new URL(databaseURL);
    const port = Number(parsedURL.port || "5432");

    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();

      socket.setTimeout(500);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("timeout"));
      });
      socket.once("error", (error) => {
        socket.destroy();
        reject(error);
      });

      socket.connect(port, parsedURL.hostname);
    });

    return true;
  } catch {
    return false;
  }
};

const describeIfDatabase = (await canReachPostgres(process.env.DATABASE_URL)) ? describe : describe.skip;

describeIfDatabase("survey lifecycle integration", () => {
  let integrationPrisma: PrismaClient;
  let schema: string;

  const quoteIdentifier = (identifier: string) => `"${identifier}"`;

  beforeAll(() => {
    return vi
      .importActual<typeof import("@prisma/client")>("@prisma/client")
      .then(({ PrismaClient: ActualPrismaClient }) => {
        integrationPrisma = new ActualPrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL,
            },
          },
        });
      });
  });

  beforeEach(async () => {
    schema = `river_test_${randomUUID().replace(/-/g, "_")}`;

    await integrationPrisma.$executeRaw(Prisma.raw(`CREATE SCHEMA ${quoteIdentifier(schema)}`));
    await integrationPrisma.$executeRaw(
      Prisma.raw(`
      CREATE TYPE ${quoteIdentifier(schema)}.${quoteIdentifier("river_job_state")} AS ENUM (
        'available',
        'scheduled',
        'retryable',
        'completed'
      )
    `)
    );
    await integrationPrisma.$executeRaw(
      Prisma.raw(`
      CREATE TABLE ${quoteIdentifier(schema)}.${quoteIdentifier("river_job")} (
        id BIGSERIAL PRIMARY KEY,
        state ${quoteIdentifier(schema)}.${quoteIdentifier("river_job_state")} NOT NULL DEFAULT 'available',
        args JSONB NOT NULL,
        kind TEXT NOT NULL,
        max_attempts SMALLINT NOT NULL,
        queue TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    );
  });

  afterEach(async () => {
    await integrationPrisma.$executeRaw(
      Prisma.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`)
    );
  });

  afterAll(async () => {
    await integrationPrisma.$disconnect();
  });

  test("persists scheduled and immediate lifecycle jobs with the expected payload", async () => {
    const surveyId = "survey_1";
    const environmentId = "env_1";
    const startsAt = new Date("2026-05-01T12:00:00.000Z");
    const endsAt = new Date("2026-03-01T12:00:00.000Z");
    const beforeInsert = new Date();

    await integrationPrisma.$transaction(async (tx) => {
      await enqueueSurveyLifecycleJobs({
        tx,
        schema,
        now: new Date("2026-04-01T12:00:00.000Z"),
        survey: {
          id: surveyId,
          environmentId,
          startsAt,
          endsAt: null,
        },
      });

      await enqueueSurveyLifecycleJobs({
        tx,
        schema,
        now: new Date("2026-04-01T12:00:00.000Z"),
        survey: {
          id: surveyId,
          environmentId,
          startsAt,
          endsAt,
        },
        previousSurvey: {
          startsAt,
          endsAt: null,
        },
      });
    });
    const afterInsert = new Date();

    const jobs = await integrationPrisma.$queryRaw<
      Array<{
        kind: string;
        queue: string;
        args: Record<string, string>;
        scheduled_at: Date;
        max_attempts: number;
      }>
    >(
      Prisma.raw(
        `SELECT kind, queue, args, scheduled_at, max_attempts
         FROM ${quoteIdentifier(schema)}.${quoteIdentifier("river_job")}
         ORDER BY kind ASC`
      )
    );

    expect(jobs).toHaveLength(2);
    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: RIVER_SURVEY_END_KIND,
          queue: RIVER_SURVEY_LIFECYCLE_QUEUE,
          args: {
            surveyId,
            environmentId,
            scheduledFor: endsAt.toISOString(),
          },
          max_attempts: RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS,
        }),
        expect.objectContaining({
          kind: RIVER_SURVEY_START_KIND,
          queue: RIVER_SURVEY_LIFECYCLE_QUEUE,
          args: {
            surveyId,
            environmentId,
            scheduledFor: startsAt.toISOString(),
          },
          scheduled_at: startsAt,
          max_attempts: RIVER_SURVEY_LIFECYCLE_MAX_ATTEMPTS,
        }),
      ])
    );

    const immediateJob = jobs.find((job) => job.kind === RIVER_SURVEY_END_KIND);
    expect(immediateJob?.scheduled_at.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime() - 1000);
    expect(immediateJob?.scheduled_at.getTime()).toBeLessThanOrEqual(afterInsert.getTime() + 1000);
  });

  test("removes only pending lifecycle jobs for the target survey", async () => {
    const surveyId = "survey_1";

    await integrationPrisma.$executeRaw(
      Prisma.raw(`
      INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier("river_job")}
        (state, args, kind, max_attempts, queue)
      VALUES
        ('available', '{"surveyId":"survey_1","environmentId":"env_1","scheduledFor":"2026-04-01T12:00:00.000Z"}', '${RIVER_SURVEY_START_KIND}', 3, '${RIVER_SURVEY_LIFECYCLE_QUEUE}'),
        ('completed', '{"surveyId":"survey_1","environmentId":"env_1","scheduledFor":"2026-04-02T12:00:00.000Z"}', '${RIVER_SURVEY_END_KIND}', 3, '${RIVER_SURVEY_LIFECYCLE_QUEUE}'),
        ('retryable', '{"surveyId":"survey_2","environmentId":"env_1","scheduledFor":"2026-04-03T12:00:00.000Z"}', '${RIVER_SURVEY_START_KIND}', 3, '${RIVER_SURVEY_LIFECYCLE_QUEUE}')
    `)
    );

    await integrationPrisma.$transaction(async (tx) => {
      await deleteSurveyLifecycleJobs({
        tx,
        surveyId,
        schema,
      });
    });

    const remainingJobs = await integrationPrisma.$queryRaw<
      Array<{ state: string; kind: string; args: { surveyId: string } }>
    >(
      Prisma.raw(
        `SELECT state, kind, args
         FROM ${quoteIdentifier(schema)}.${quoteIdentifier("river_job")}
         ORDER BY state ASC, kind ASC`
      )
    );

    expect(remainingJobs).toEqual([
      {
        state: "completed",
        kind: RIVER_SURVEY_END_KIND,
        args: {
          surveyId: "survey_1",
          environmentId: "env_1",
          scheduledFor: "2026-04-02T12:00:00.000Z",
        },
      },
      {
        state: "retryable",
        kind: RIVER_SURVEY_START_KIND,
        args: {
          surveyId: "survey_2",
          environmentId: "env_1",
          scheduledFor: "2026-04-03T12:00:00.000Z",
        },
      },
    ]);
  });
});
