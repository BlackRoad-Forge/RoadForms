import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  handleTriggerUpdates as handleTriggerUpdatesFromService,
  updateSurvey as updateSurveyFromService,
  updateSurveyInternal,
} from "@/lib/survey/service";
import { handleTriggerUpdates, updateSurvey, updateSurveyDraft } from "./survey";

vi.mock("@/lib/survey/service", () => ({
  handleTriggerUpdates: vi.fn(),
  updateSurvey: vi.fn(),
  updateSurveyInternal: vi.fn(),
}));

describe("survey editor wrappers", () => {
  const survey = { id: "survey_1" } as TSurvey;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("re-exports the shared trigger update helper", () => {
    expect(handleTriggerUpdates).toBe(handleTriggerUpdatesFromService);
  });

  test("delegates updateSurvey to the shared survey service", async () => {
    vi.mocked(updateSurveyFromService).mockResolvedValueOnce(survey);

    const result = await updateSurvey(survey);

    expect(updateSurveyFromService).toHaveBeenCalledWith(survey);
    expect(result).toBe(survey);
  });

  test("delegates draft saves to updateSurveyInternal with skipValidation enabled", async () => {
    vi.mocked(updateSurveyInternal).mockResolvedValueOnce(survey);

    const result = await updateSurveyDraft(survey);

    expect(updateSurveyInternal).toHaveBeenCalledWith(survey, true);
    expect(result).toBe(survey);
  });

  test("propagates service errors for updateSurvey", async () => {
    const error = new DatabaseError("database error");
    vi.mocked(updateSurveyFromService).mockRejectedValueOnce(error);

    await expect(updateSurvey(survey)).rejects.toThrow(error);
  });

  test("propagates service errors for updateSurveyDraft", async () => {
    const error = new ResourceNotFoundError("Survey", "survey_1");
    vi.mocked(updateSurveyInternal).mockRejectedValueOnce(error);

    await expect(updateSurveyDraft(survey)).rejects.toThrow(error);
  });
});
