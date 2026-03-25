import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

interface CapturedRequest {
  method?: string;
  url?: string;
  headers: IncomingMessage["headers"];
  body: string;
}

describe("sendInngestEvents", () => {
  let server: Server;
  let capturedRequests: CapturedRequest[];

  beforeEach(async () => {
    capturedRequests = [];
    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];

      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      capturedRequests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: 200, ids: ["evt_1", "evt_2"] }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
  });

  afterEach(async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/env");
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  test("posts events to the self-hosted event API using the configured event key and timestamp", async () => {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/`;

    vi.doMock("@/lib/env", () => ({
      env: {
        INNGEST_BASE_URL: baseUrl,
        INNGEST_EVENT_KEY: "test-event-key",
      },
    }));

    const { resetInngestClientForTests, sendInngestEvents } = await import("./client");

    await sendInngestEvents([
      {
        name: "survey.start",
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
          scheduledFor: "2026-04-01T12:00:00.000Z",
        },
        ts: 1775044800000,
      },
      {
        name: "survey.end.cancelled",
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
        },
      },
    ]);

    resetInngestClientForTests();

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.method).toBe("POST");
    expect(capturedRequests[0]?.url).toBe("/e/test-event-key");
    expect(capturedRequests[0]?.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(capturedRequests[0]?.body ?? "[]")).toEqual([
      {
        name: "survey.start",
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
          scheduledFor: "2026-04-01T12:00:00.000Z",
        },
        ts: 1775044800000,
      },
      {
        name: "survey.end.cancelled",
        data: {
          surveyId: "survey_1",
          environmentId: "env_1",
        },
        ts: expect.any(Number),
      },
    ]);
  });
});
