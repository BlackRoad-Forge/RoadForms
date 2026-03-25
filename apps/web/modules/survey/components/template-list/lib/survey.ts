import { TSurvey, TSurveyCreateInput } from "@formbricks/types/surveys/types";
import { createSurvey as createSurveyFromService, handleTriggerUpdates } from "@/lib/survey/service";

export { handleTriggerUpdates };

export const createSurvey = async (
  environmentId: string,
  surveyBody: TSurveyCreateInput
): Promise<TSurvey> => {
  return createSurveyFromService(environmentId, surveyBody);
};
