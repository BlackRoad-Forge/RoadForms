import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteSurveyLifecycleJobs } from "@/lib/river/survey-lifecycle";
import { validateInputs } from "@/lib/utils/validate";

export const deleteSurvey = async (surveyId: string) => {
  validateInputs([surveyId, z.cuid2()]);

  try {
    const deletedSurvey = await prisma.$transaction(async (tx) => {
      await deleteSurveyLifecycleJobs({ tx, surveyId });

      const removedSurvey = await tx.survey.delete({
        where: {
          id: surveyId,
        },
        include: {
          segment: true,
          triggers: {
            include: {
              actionClass: true,
            },
          },
        },
      });

      if (removedSurvey.type === "app" && removedSurvey.segment?.isPrivate) {
        await tx.segment.delete({
          where: {
            id: removedSurvey.segment.id,
          },
        });
      }

      return removedSurvey;
    });

    return deletedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error({ error, surveyId }, "Error deleting survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
