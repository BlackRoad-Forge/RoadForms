import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey, TSurveyCreateInput } from "@formbricks/types/surveys/types";
import {
  createSurvey as createSurveyFromService,
  handleTriggerUpdates as handleTriggerUpdatesFromService,
} from "@/lib/survey/service";
import { createSurvey, handleTriggerUpdates } from "./survey";

vi.mock("@/lib/survey/service", () => ({
  createSurvey: vi.fn(),
  handleTriggerUpdates: vi.fn(),
}));

describe("template list survey wrappers", () => {
  const environmentId = "env_1";
  const surveyBody = { name: "Survey" } as TSurveyCreateInput;
  const createdSurvey = { id: "survey_1" } as TSurvey;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("re-exports the shared trigger update helper", () => {
    expect(handleTriggerUpdates).toBe(handleTriggerUpdatesFromService);
  });

  test("delegates createSurvey to the shared survey service", async () => {
    vi.mocked(createSurveyFromService).mockResolvedValueOnce(createdSurvey);

    const result = await createSurvey(environmentId, surveyBody);

    expect(createSurveyFromService).toHaveBeenCalledWith(environmentId, surveyBody);
    expect(result).toBe(createdSurvey);
  });

  test("propagates service errors", async () => {
    const error = new DatabaseError("database error");
    vi.mocked(createSurveyFromService).mockRejectedValueOnce(error);

    await expect(createSurvey(environmentId, surveyBody)).rejects.toThrow(error);
  });
});
