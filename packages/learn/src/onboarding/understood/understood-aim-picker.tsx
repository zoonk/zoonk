"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { AimPicker } from "../../language-aim/aim-picker";
import { type UnderstoodRow as Row } from "./use-understood-rows";

export function AimRowPicker({
  onSave,
  row,
}: {
  onSave: (value: string) => Promise<boolean>;
  row: Row;
}) {
  const t = useExtracted();

  return (
    <AimPicker
      onPick={onSave}
      options={(row.aimChoices ?? []).map((choice) => ({ aim: choice.aim }))}
      trigger={
        <Button
          aria-label={t("Edit {field}", { field: row.label })}
          className="text-muted-foreground -my-2 shrink-0"
          edge="end"
          size="icon"
          variant="ghost"
        />
      }
      value={row.value}
    >
      <ChevronDownIcon aria-hidden="true" />
    </AimPicker>
  );
}
