"use client";

import { FolderIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createFeedbackRecordDirectoryAction } from "@/modules/ee/feedback-record-directory/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface CreateFeedbackRecordDirectoryModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  organizationId: string;
}

export const CreateFeedbackRecordDirectoryModal = ({
  open,
  setOpen,
  organizationId,
}: CreateFeedbackRecordDirectoryModalProps) => {
  const [directoryName, setDirectoryName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  const handleCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const name = directoryName.trim();
    const response = await createFeedbackRecordDirectoryAction({ name, organizationId });
    if (response?.data) {
      toast.success(t("environments.settings.feedback_record_directories.directory_created_successfully"));
      router.refresh();
      setOpen(false);
      setDirectoryName("");
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage);
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <FolderIcon />
          <DialogTitle>
            {t("environments.settings.feedback_record_directories.create_new_directory")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreation} className="gap-y-4 pt-4">
          <DialogBody>
            <div className="grid w-full gap-y-2 pb-4">
              <Label htmlFor="directory-name">
                {t("environments.settings.feedback_record_directories.directory_name")}
              </Label>
              <Input
                id="directory-name"
                name="directory-name"
                value={directoryName}
                onChange={(e) => {
                  setDirectoryName(e.target.value);
                }}
                placeholder={t("environments.settings.feedback_record_directories.enter_directory_name")}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setOpen(false);
                setDirectoryName("");
              }}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!directoryName || isLoading} loading={isLoading} type="submit">
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
