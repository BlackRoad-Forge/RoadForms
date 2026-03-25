import { TSurvey } from "@formbricks/types/surveys/types";
import {
  handleTriggerUpdates,
  updateSurvey as updateSurveyFromService,
  updateSurveyInternal,
} from "@/lib/survey/service";

export { handleTriggerUpdates };

export const updateSurveyDraft = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  return updateSurveyInternal(updatedSurvey, true);
};

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  return updateSurveyFromService(updatedSurvey);
};
