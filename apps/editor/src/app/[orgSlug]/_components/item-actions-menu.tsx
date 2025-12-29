"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { toast } from "@zoonk/ui/components/sonner";
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { ImportDialog } from "./import-dialog";

const EXAMPLE_FORMAT = {
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

export function ItemActionsMenu({
  cancelLabel,
  dropLabel,
  entityType,
  exportErrorMessage,
  exportLabel,
  exportSuccessMessage,
  fileSizeUnit,
  importDescription,
  importLabel,
  importSuccessMessage,
  importTitle,
  modeLabel,
  modeMergeLabel,
  modeReplaceLabel,
  moreOptionsLabel,
  onExport,
  onImport,
  showFormatLabel,
}: {
  cancelLabel: string;
  dropLabel: string;
  entityType: "chapters" | "lessons";
  exportErrorMessage: string;
  exportLabel: string;
  exportSuccessMessage: string;
  fileSizeUnit: string;
  importDescription: string;
  importLabel: string;
  importSuccessMessage: string;
  importTitle: string;
  modeLabel: string;
  modeMergeLabel: string;
  modeReplaceLabel: string;
  moreOptionsLabel: string;
  onExport: () => Promise<{ data: object | null; error: Error | null }>;
  onImport: (formData: FormData) => Promise<{ error: string | null }>;
  showFormatLabel: string;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const { data, error } = await onExport();

      if (error || !data) {
        toast.error(error?.message ?? exportErrorMessage);
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

      toast.success(exportSuccessMessage);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">{moreOptionsLabel}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <UploadIcon />
            {importLabel}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleExport}>
            <DownloadIcon />
            {exportLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportDialog
        cancelLabel={cancelLabel}
        description={importDescription}
        dropLabel={dropLabel}
        exampleFormat={EXAMPLE_FORMAT[entityType]}
        fileSizeUnit={fileSizeUnit}
        importLabel={importLabel}
        modeLabel={modeLabel}
        modeMergeLabel={modeMergeLabel}
        modeReplaceLabel={modeReplaceLabel}
        onImport={onImport}
        onOpenChange={setImportOpen}
        open={importOpen}
        showFormatLabel={showFormatLabel}
        successMessage={importSuccessMessage}
        title={importTitle}
      />
    </>
  );
}
