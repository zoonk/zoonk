"use client";

import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { useExtracted } from "next-intl";
import {
  ImportCancel,
  ImportDropzone,
  ImportFormatPreview,
  ImportModeOption,
  ImportModeSelector,
  ImportSubmit,
} from "../import";

const IMPORT_FORMAT = {
  alternativeTitles: ["title-slug-1", "title-slug-2"],
};

type AlternativeTitlesImportDialogProps = {
  onClose: () => void;
};

export function AlternativeTitlesImportDialog({ onClose }: AlternativeTitlesImportDialogProps) {
  const t = useExtracted();

  return (
    <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("Import alternative titles")}</DialogTitle>
        <DialogDescription>
          {t("Upload a JSON file containing alternative titles to import.")}
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-w-0 gap-6">
        <ImportDropzone>{t("Drop file or click to select")}</ImportDropzone>

        <ImportModeSelector label={t("Import mode")}>
          <ImportModeOption value="merge">{t("Merge (add to existing)")}</ImportModeOption>
          <ImportModeOption value="replace">
            {t("Replace (remove existing first)")}
          </ImportModeOption>
        </ImportModeSelector>

        <ImportFormatPreview format={IMPORT_FORMAT} label={t("Show expected format")} />
      </div>

      <DialogFooter>
        <ImportCancel onClick={onClose}>{t("Cancel")}</ImportCancel>
        <ImportSubmit>{t("Import")}</ImportSubmit>
      </DialogFooter>
    </DialogContent>
  );
}
