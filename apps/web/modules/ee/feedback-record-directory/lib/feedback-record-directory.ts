import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  TFeedbackRecordDirectory,
  TFeedbackRecordDirectoryDetails,
  TFeedbackRecordDirectoryFormSchema,
  ZFeedbackRecordDirectoryFormSchema,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";

export const getFeedbackRecordDirectories = reactCache(
  async (organizationId: string): Promise<TFeedbackRecordDirectory[]> => {
    validateInputs([organizationId, ZId]);
    try {
      const directories = await prisma.feedbackRecordDirectory.findMany({
        where: {
          organizationId,
        },
        select: {
          id: true,
          name: true,
          isArchived: true,
          _count: {
            select: {
              projects: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return directories.map((dir) => ({
        id: dir.id,
        name: dir.name,
        isArchived: dir.isArchived,
        projectCount: dir._count.projects,
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getFeedbackRecordDirectoryDetails = reactCache(
  async (directoryId: string): Promise<TFeedbackRecordDirectoryDetails | null> => {
    validateInputs([directoryId, ZId]);
    try {
      const directory = await prisma.feedbackRecordDirectory.findUnique({
        where: {
          id: directoryId,
        },
        select: {
          id: true,
          name: true,
          isArchived: true,
          organizationId: true,
          projects: {
            select: {
              projectId: true,
              project: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!directory) {
        return null;
      }

      return {
        id: directory.id,
        name: directory.name,
        isArchived: directory.isArchived,
        organizationId: directory.organizationId,
        projects: directory.projects.map((dp) => ({
          projectId: dp.projectId,
          projectName: dp.project.name,
        })),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const createFeedbackRecordDirectory = async (
  organizationId: string,
  name: string
): Promise<string> => {
  validateInputs([organizationId, ZId], [name, z.string()]);
  try {
    const existingDirectory = await prisma.feedbackRecordDirectory.findFirst({
      where: {
        name,
        organizationId,
      },
    });

    if (existingDirectory) {
      throw new InvalidInputError("A feedback record directory with this name already exists");
    }

    if (name.trim().length < 1) {
      throw new InvalidInputError("Directory name must be at least 1 character long");
    }

    const directory = await prisma.feedbackRecordDirectory.create({
      data: {
        name,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    return directory.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateFeedbackRecordDirectory = async (
  directoryId: string,
  data: TFeedbackRecordDirectoryFormSchema
): Promise<boolean> => {
  validateInputs([directoryId, ZId], [data, ZFeedbackRecordDirectoryFormSchema]);

  try {
    const { name, projects } = data;

    const directory = await prisma.feedbackRecordDirectory.findUnique({
      where: { id: directoryId },
    });

    if (!directory) {
      throw new ResourceNotFoundError("FeedbackRecordDirectory", directoryId);
    }

    const currentDetails = await getFeedbackRecordDirectoryDetails(directoryId);
    if (!currentDetails) {
      throw new ResourceNotFoundError("FeedbackRecordDirectory", directoryId);
    }

    // Validate that all specified projects belong to the same organization
    const projectIds = projects.map((p) => p.projectId);
    if (projectIds.length > 0) {
      const orgProjectsCount = await prisma.project.count({
        where: {
          id: { in: projectIds },
          organizationId: directory.organizationId,
        },
      });
      if (orgProjectsCount !== projectIds.length) {
        throw new InvalidInputError("Some specified projects do not belong to the organization.");
      }
    }

    // Determine deleted projects (in current but not in new)
    const deletedProjects: string[] = [];
    for (const cp of currentDetails.projects) {
      if (!projects.some((p) => p.projectId === cp.projectId)) {
        deletedProjects.push(cp.projectId);
      }
    }

    const payload: Prisma.FeedbackRecordDirectoryUpdateInput = {
      name: currentDetails.name !== name ? name : undefined,
      projects: {
        deleteMany: {
          projectId: { in: deletedProjects },
        },
        upsert: projects.map((p) => ({
          where: {
            feedbackRecordDirectoryId_projectId: {
              feedbackRecordDirectoryId: directoryId,
              projectId: p.projectId,
            },
          },
          update: {},
          create: { projectId: p.projectId },
        })),
      },
    };

    await prisma.feedbackRecordDirectory.update({
      where: { id: directoryId },
      data: payload,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const archiveFeedbackRecordDirectory = async (directoryId: string): Promise<boolean> => {
  validateInputs([directoryId, ZId]);
  try {
    await prisma.feedbackRecordDirectory.update({
      where: { id: directoryId },
      data: { isArchived: true },
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const unarchiveFeedbackRecordDirectory = async (directoryId: string): Promise<boolean> => {
  validateInputs([directoryId, ZId]);
  try {
    await prisma.feedbackRecordDirectory.update({
      where: { id: directoryId },
      data: { isArchived: false },
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getOrganizationIdFromDirectoryId = async (directoryId: string): Promise<string> => {
  validateInputs([directoryId, ZId]);
  const directory = await prisma.feedbackRecordDirectory.findUnique({
    where: { id: directoryId },
    select: { organizationId: true },
  });

  if (!directory) {
    throw new ResourceNotFoundError("FeedbackRecordDirectory", directoryId);
  }

  return directory.organizationId;
};
