"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { DownloadIcon, EllipsisVerticalIcon, UploadIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type AlternativeTitlesFormActionsProps = {
  disabled: boolean;
  onExport: () => void;
  onImport: () => void;
};

export function AlternativeTitlesFormActions({
  disabled,
  onExport,
  onImport,
}: AlternativeTitlesFormActionsProps) {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} render={<Button size="icon-sm" variant="ghost" />}>
        <EllipsisVerticalIcon />
        <span className="sr-only">{t("More options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onImport}>
          <UploadIcon />
          {t("Import")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onExport}>
          <DownloadIcon />
          {t("Export")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
