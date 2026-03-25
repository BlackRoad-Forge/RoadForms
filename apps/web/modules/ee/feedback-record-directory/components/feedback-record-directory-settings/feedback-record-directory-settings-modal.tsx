"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateFeedbackRecordDirectoryAction } from "@/modules/ee/feedback-record-directory/actions";
import { ArchiveFeedbackRecordDirectory } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-settings/archive-feedback-record-directory";
import {
  TFeedbackRecordDirectoryDetails,
  TFeedbackRecordDirectoryFormSchema,
  ZFeedbackRecordDirectoryFormSchema,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Input } from "@/modules/ui/components/input";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Muted } from "@/modules/ui/components/typography";

interface FeedbackRecordDirectorySettingsModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  directory: TFeedbackRecordDirectoryDetails;
  orgProjects: TOrganizationProject[];
  membershipRole?: TOrganizationRole;
}

export const FeedbackRecordDirectorySettingsModal = ({
  open,
  setOpen,
  directory,
  orgProjects,
  membershipRole,
}: FeedbackRecordDirectorySettingsModalProps) => {
  const { t } = useTranslation();
  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const router = useRouter();

  const initialProjectIds = useMemo(() => {
    return new Set(directory.projects.map((project) => project.projectId));
  }, [directory.projects]);

  const initialProjects = useMemo(() => {
    const projects = directory.projects.map((project) => ({
      projectId: project.projectId,
    }));
    return projects.length ? projects : [{ projectId: "" }];
  }, [directory.projects]);

  const form = useForm<TFeedbackRecordDirectoryFormSchema>({
    defaultValues: {
      name: directory.name,
      projects: initialProjects,
    },
    mode: "onChange",
    resolver: zodResolver(ZFeedbackRecordDirectoryFormSchema),
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    setValue,
  } = form;

  const closeSettingsModal = () => {
    setOpen(false);
  };

  const handleUpdate: SubmitHandler<TFeedbackRecordDirectoryFormSchema> = async (data) => {
    const projects = data.projects.filter((p) => p.projectId);

    const response = await updateFeedbackRecordDirectoryAction({
      directoryId: directory.id,
      data: {
        name: data.name,
        projects,
      },
    });

    if (response?.data) {
      toast.success(t("environments.settings.feedback_record_directories.directory_updated_successfully"));
      closeSettingsModal();
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage);
    }
  };

  const watchProjects = useWatch({ control, name: "projects" }) || [];

  const handleAddProject = () => {
    const newProjects = [...watchProjects, { projectId: "" }];
    setValue("projects", newProjects);
  };

  const handleRemoveProject = (index: number) => {
    setValue(
      "projects",
      watchProjects.filter((_, i) => i !== index)
    );
  };

  const selectedProjectIds = watchProjects.map((p) => p.projectId);

  const getProjectOptionsForIndex = (index: number) => {
    const currentProjectId = watchProjects[index]?.projectId;
    return orgProjects
      .filter((op) => !selectedProjectIds.includes(op?.id) || op?.id === currentProjectId)
      .map((op) => ({ label: op?.name ?? "", value: op?.id }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  };

  const hasEmptyProject = watchProjects.some((p) => !p.projectId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>
            {t("environments.settings.feedback_record_directories.directory_settings_title", {
              directoryName: directory.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("environments.settings.feedback_record_directories.directory_settings_description")}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents space-y-4" onSubmit={handleSubmit(handleUpdate)}>
            <DialogBody className="flex-grow space-y-6 overflow-y-auto">
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>
                      {t("environments.settings.feedback_record_directories.directory_name")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("environments.settings.feedback_record_directories.directory_name")}
                        {...field}
                        disabled={!isOwnerOrManager}
                      />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              <IdBadge
                id={directory.id}
                label={t("environments.settings.feedback_record_directories.directory_id")}
                variant="column"
              />

              {/* Workspace Assignments Section */}
              <div className="space-y-2">
                <div className="flex flex-col space-y-1">
                  <FormLabel>{t("common.workspaces")}</FormLabel>
                  <Muted className="block text-slate-500">
                    {t("environments.settings.feedback_record_directories.assign_workspaces_description")}
                  </Muted>
                </div>
                <FormField
                  control={control}
                  name="projects"
                  render={({ fieldState: { error } }) => (
                    <FormItem className="flex-1">
                      <div className="space-y-2">
                        {watchProjects.map((project, index) => {
                          const isExistingProject =
                            project.projectId && initialProjectIds.has(project.projectId);
                          const isSelectDisabled = isExistingProject || !isOwnerOrManager;

                          return (
                            <div key={`project-${project.projectId}-${index}`} className="flex gap-2.5">
                              <FormField
                                control={control}
                                name={`projects.${index}.projectId`}
                                render={({ field, fieldState: { error: fieldError } }) => (
                                  <FormItem className="flex-1">
                                    <div
                                      className={
                                        isSelectDisabled ? "pointer-events-none opacity-50" : undefined
                                      }>
                                      <InputCombobox
                                        id={`project-select-${index}`}
                                        options={getProjectOptionsForIndex(index)}
                                        value={field.value || null}
                                        onChangeValue={(val) => {
                                          const value = typeof val === "string" ? val : "";
                                          field.onChange(value);
                                        }}
                                        showSearch
                                        searchPlaceholder={t("common.search")}
                                        comboboxClasses="flex-1 min-w-0 w-full"
                                        emptyDropdownText={t("environments.surveys.edit.no_option_found")}
                                      />
                                    </div>
                                    {fieldError?.message && (
                                      <FormError className="text-left">{fieldError.message}</FormError>
                                    )}
                                  </FormItem>
                                )}
                              />
                              {watchProjects.length > 1 && (
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="secondary"
                                  className="shrink-0"
                                  disabled={!isOwnerOrManager}
                                  onClick={() => handleRemoveProject(index)}>
                                  <Trash2Icon className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {error?.root?.message && (
                        <FormError className="text-left">{error.root.message}</FormError>
                      )}
                    </FormItem>
                  )}
                />

                <TooltipRenderer
                  shouldRender={selectedProjectIds.length === orgProjects.length || hasEmptyProject}
                  triggerClass="inline-block"
                  tooltipContent={
                    hasEmptyProject
                      ? t(
                          "environments.settings.feedback_record_directories.please_fill_all_workspace_fields"
                        )
                      : t("environments.settings.feedback_record_directories.all_workspaces_added")
                  }>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={handleAddProject}
                    disabled={
                      !isOwnerOrManager || selectedProjectIds.length === orgProjects.length || hasEmptyProject
                    }>
                    <PlusIcon className="h-4 w-4" />
                    {t("common.add_workspace")}
                  </Button>
                </TooltipRenderer>
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="w-full">
                <ArchiveFeedbackRecordDirectory
                  directoryId={directory.id}
                  onArchive={closeSettingsModal}
                  isOwnerOrManager={isOwnerOrManager}
                />
              </div>
              <Button size="default" type="button" variant="outline" onClick={closeSettingsModal}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="default" loading={isSubmitting} disabled={!isOwnerOrManager}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
