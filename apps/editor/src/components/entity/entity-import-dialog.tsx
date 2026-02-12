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
  ImportModeOption,
  ImportModeSelector,
  ImportReplaceWarning,
  ImportSubmit,
} from "../import";
import { ImportFormatPreview } from "../import-format-preview";

type EntityType = "activities" | "chapters" | "lessons";

const FORMATS: Record<EntityType, object> = {
  activities: {
    activities: [
      {
        description: "Activity description",
        kind: "background",
        title: "Activity title",
      },
    ],
  },
  chapters: {
    chapters: [
      {
        description: "Chapter description",
        slug: "optional-slug",
        title: "Chapter title",
      },
    ],
  },
  lessons: {
    lessons: [
      {
        description: "Lesson description",
        slug: "optional-slug",
        title: "Lesson title",
      },
    ],
  },
};

export function EntityImportDialog({
  entityType,
  importDescription,
  importTitle,
  onClose,
}: {
  entityType: EntityType;
  importDescription: string;
  importTitle: string;
  onClose: () => void;
}) {
  const t = useExtracted();

  return (
    <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{importTitle}</DialogTitle>
        <DialogDescription>{importDescription}</DialogDescription>
      </DialogHeader>

      <div className="grid min-w-0 gap-6">
        <ImportDropzone>{t("Drop file or click to select")}</ImportDropzone>

        <ImportModeSelector label={t("Import mode")}>
          <ImportModeOption value="merge">{t("Merge (add to existing)")}</ImportModeOption>
          <ImportModeOption value="replace">
            {t("Replace (remove existing first)")}
          </ImportModeOption>
        </ImportModeSelector>

        <ImportReplaceWarning>
          {t(
            "This will permanently delete all existing items and any learner progress associated with them. This action cannot be undone.",
          )}
        </ImportReplaceWarning>

        <ImportFormatPreview format={FORMATS[entityType]} label={t("Show expected format")} />
      </div>

      <DialogFooter>
        <ImportCancel onClick={onClose}>{t("Cancel")}</ImportCancel>
        <ImportSubmit replaceChildren={t("Replace all")}>{t("Import")}</ImportSubmit>
      </DialogFooter>
    </DialogContent>
  );
}
