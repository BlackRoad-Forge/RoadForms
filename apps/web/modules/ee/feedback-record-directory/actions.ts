"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import {
  archiveFeedbackRecordDirectory,
  createFeedbackRecordDirectory,
  getFeedbackRecordDirectoryDetails,
  getOrganizationIdFromDirectoryId,
  unarchiveFeedbackRecordDirectory,
  updateFeedbackRecordDirectory,
} from "@/modules/ee/feedback-record-directory/lib/feedback-record-directory";
import { ZFeedbackRecordDirectoryFormSchema } from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";

const ZCreateFeedbackRecordDirectoryAction = z.object({
  organizationId: z.cuid(),
  name: z.string().trim().min(1, "Directory name is required"),
});

export const createFeedbackRecordDirectoryAction = authenticatedActionClient
  .inputSchema(ZCreateFeedbackRecordDirectoryAction)
  .action(
    withAuditLogging("created", "feedbackRecordDirectory", async ({ ctx, parsedInput }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      const result = await createFeedbackRecordDirectory(parsedInput.organizationId, parsedInput.name);
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.feedbackRecordDirectoryId = result;
      ctx.auditLoggingCtx.newObject = {
        ...(await getFeedbackRecordDirectoryDetails(result)),
      };
      return result;
    })
  );

const ZGetFeedbackRecordDirectoryDetailsAction = z.object({
  directoryId: ZId,
});

export const getFeedbackRecordDirectoryDetailsAction = authenticatedActionClient
  .inputSchema(ZGetFeedbackRecordDirectoryDetailsAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    return await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
  });

const ZUpdateFeedbackRecordDirectoryAction = z.object({
  directoryId: ZId,
  data: ZFeedbackRecordDirectoryFormSchema,
});

export const updateFeedbackRecordDirectoryAction = authenticatedActionClient
  .inputSchema(ZUpdateFeedbackRecordDirectoryAction)
  .action(
    withAuditLogging("updated", "feedbackRecordDirectory", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.feedbackRecordDirectoryId = parsedInput.directoryId;
      const oldObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      const result = await updateFeedbackRecordDirectory(parsedInput.directoryId, parsedInput.data);
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      return result;
    })
  );

const ZArchiveFeedbackRecordDirectoryAction = z.object({
  directoryId: ZId,
});

export const archiveFeedbackRecordDirectoryAction = authenticatedActionClient
  .inputSchema(ZArchiveFeedbackRecordDirectoryAction)
  .action(
    withAuditLogging("deleted", "feedbackRecordDirectory", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.feedbackRecordDirectoryId = parsedInput.directoryId;
      const oldObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      return await archiveFeedbackRecordDirectory(parsedInput.directoryId);
    })
  );

const ZUnarchiveFeedbackRecordDirectoryAction = z.object({
  directoryId: ZId,
});

export const unarchiveFeedbackRecordDirectoryAction = authenticatedActionClient
  .inputSchema(ZUnarchiveFeedbackRecordDirectoryAction)
  .action(
    withAuditLogging("updated", "feedbackRecordDirectory", async ({ ctx, parsedInput }) => {
      const organizationId = await getOrganizationIdFromDirectoryId(parsedInput.directoryId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.feedbackRecordDirectoryId = parsedInput.directoryId;
      const oldObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      const result = await unarchiveFeedbackRecordDirectory(parsedInput.directoryId);
      ctx.auditLoggingCtx.newObject = await getFeedbackRecordDirectoryDetails(parsedInput.directoryId);
      return result;
    })
  );
