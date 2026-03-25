import "server-only";
import { Inngest } from "inngest";
import { env } from "@/lib/env";
import { INNGEST_POC_APP_ID } from "./constants";

export interface InngestScheduledEventData {
  surveyId: string;
  environmentId: string;
  scheduledFor: string;
}

export interface InngestCancelledEventData {
  surveyId: string;
  environmentId: string;
}

export type InngestSendableEvent =
  | {
      name: string;
      data: InngestScheduledEventData;
      ts?: number;
    }
  | {
      name: string;
      data: InngestCancelledEventData;
      ts?: number;
    };

interface InngestEventClient {
  send: (payload: InngestSendableEvent | InngestSendableEvent[]) => Promise<unknown>;
}

let inngestClient: InngestEventClient | null = null;

const getRequiredEnv = (): { baseUrl: string; eventKey: string } => {
  if (!env.INNGEST_BASE_URL) {
    throw new Error("INNGEST_BASE_URL is required to publish survey lifecycle events");
  }

  if (!env.INNGEST_EVENT_KEY) {
    throw new Error("INNGEST_EVENT_KEY is required to publish survey lifecycle events");
  }

  return {
    baseUrl: env.INNGEST_BASE_URL,
    eventKey: env.INNGEST_EVENT_KEY,
  };
};

const createInngestClient = (): InngestEventClient => {
  const { baseUrl, eventKey } = getRequiredEnv();

  return new Inngest({
    id: INNGEST_POC_APP_ID,
    baseUrl,
    eventKey,
    isDev: false,
  }) as unknown as InngestEventClient;
};

const getInngestClient = (): InngestEventClient => {
  if (!inngestClient) {
    inngestClient = createInngestClient();
  }

  return inngestClient;
};

export const resetInngestClientForTests = (): void => {
  inngestClient = null;
};

export const sendInngestEvents = async (events: InngestSendableEvent[]): Promise<unknown> => {
  if (events.length === 0) {
    return [];
  }

  return getInngestClient().send(events);
};
