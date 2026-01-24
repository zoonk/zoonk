"use client";

import { Button } from "@zoonk/ui/components/button";
import { Dialog } from "@zoonk/ui/components/dialog";
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
import { ImportProvider } from "../import";
import { EntityImportDialog } from "./entity-import-dialog";

export function EntityListActions({
  entityType,
  onExport,
  onImport,
}: {
  entityType: "activities" | "chapters" | "lessons";
  onExport: () => Promise<{ data: object | null; error: Error | null }>;
  onImport: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const t = useExtracted();
  const [importOpen, setImportOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const labels = {
    activities: {
      exportSuccess: t("Activities exported successfully"),
      importDescription: t("Upload a JSON file containing activities to import."),
      importSuccess: t("Activities imported successfully"),
      importTitle: t("Import activities"),
    },
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
      document.body.append(a);
      a.click();
      a.remove();
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
        <DropdownMenuTrigger disabled={pending} render={<Button size="icon-sm" variant="ghost" />}>
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
          <EntityImportDialog
            entityType={entityType}
            importDescription={entityLabels.importDescription}
            importTitle={entityLabels.importTitle}
            onClose={() => setImportOpen(false)}
          />
        </Dialog>
      </ImportProvider>
    </>
  );
}
