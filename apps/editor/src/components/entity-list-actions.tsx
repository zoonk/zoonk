"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { toast } from "@zoonk/ui/components/sonner";
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  ImportCancel,
  ImportDropzone,
  ImportFormatPreview,
  ImportModeOption,
  ImportModeSelector,
  ImportProvider,
  ImportSubmit,
} from "./import";

type EntityType = "chapters" | "lessons";

const FORMATS: Record<EntityType, object> = {
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

export function EntityListActions({
  entityType,
  onExport,
  onImport,
}: {
  entityType: EntityType;
  onExport: () => Promise<{ data: object | null; error: Error | null }>;
  onImport: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const t = useExtracted();
  const [importOpen, setImportOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const labels = {
    chapters: {
      exportSuccess: t("Chapters exported successfully"),
      importDescription: t("Upload a JSON file containing chapters to import."),
      importSuccess: t("Chapters imported successfully"),
      importTitle: t("Import chapters"),
    },
    lessons: {
      exportSuccess: t("Lessons exported successfully"),
      importDescription: t("Upload a JSON file containing lessons to import."),
      importSuccess: t("Lessons imported successfully"),
      importTitle: t("Import lessons"),
    },
  } as const;

  const entityLabels = labels[entityType];

  function handleExport() {
    startTransition(async () => {
      const { data, error } = await onExport();

      if (error || !data) {
        toast.error(error?.message ?? t("Failed to export"));
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityType}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(entityLabels.exportSuccess);
    });
  }

  function handleImportSuccess() {
    toast.success(entityLabels.importSuccess);
    setImportOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">{t("More options")}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <UploadIcon />
            {t("Import")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleExport}>
            <DownloadIcon />
            {t("Export")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportProvider onImport={onImport} onSuccess={handleImportSuccess}>
        <Dialog onOpenChange={setImportOpen} open={importOpen}>
          <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{entityLabels.importTitle}</DialogTitle>
              <DialogDescription>
                {entityLabels.importDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-w-0 gap-6">
              <ImportDropzone>
                {t("Drop file or click to select")}
              </ImportDropzone>

              <ImportModeSelector label={t("Import mode")}>
                <ImportModeOption value="merge">
                  {t("Merge (add to existing)")}
                </ImportModeOption>
                <ImportModeOption value="replace">
                  {t("Replace (remove existing first)")}
                </ImportModeOption>
              </ImportModeSelector>

              <ImportFormatPreview
                format={FORMATS[entityType]}
                label={t("Show expected format")}
              />
            </div>

            <DialogFooter>
              <ImportCancel onClick={() => setImportOpen(false)}>
                {t("Cancel")}
              </ImportCancel>
              <ImportSubmit>{t("Import")}</ImportSubmit>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ImportProvider>
    </>
  );
}
