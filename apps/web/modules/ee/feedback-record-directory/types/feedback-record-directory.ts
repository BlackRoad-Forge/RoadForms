import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackRecordDirectory = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  projectCount: z.number(),
});

export type TFeedbackRecordDirectory = z.infer<typeof ZFeedbackRecordDirectory>;

export const ZFeedbackRecordDirectoryDetails = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  organizationId: ZId,
  projects: z.array(
    z.object({
      projectId: ZId,
      projectName: z.string(),
    })
  ),
});

export type TFeedbackRecordDirectoryDetails = z.infer<typeof ZFeedbackRecordDirectoryDetails>;

export const ZFeedbackRecordDirectoryFormSchema = z.object({
  name: z.string().trim().min(1, "Directory name is required"),
  projects: z.array(
    z.object({
      projectId: z.string().trim().min(1, "Please select a workspace"),
    })
  ),
});

export type TFeedbackRecordDirectoryFormSchema = z.infer<typeof ZFeedbackRecordDirectoryFormSchema>;
