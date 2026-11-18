"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "./list-group";

export function SettingRow({
  children,
  className,
  description,
  descriptionId,
  label,
  stacked = false,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  descriptionId?: string;
  label: React.ReactNode;
  /** On a phone the control goes under the label; `wide` also gives it a fixed width beside it. */
  stacked?: boolean;
  wide?: boolean;
}) {
  const stacks = stacked || wide;

  return (
    <ListRow
      className={cn(
        "items-center gap-x-4",
        stacks && "flex-col items-stretch gap-y-0 pb-3 sm:flex-row sm:items-center sm:pb-0",
        className,
      )}
    >
      <ListRowContent className={cn(stacks && "sm:py-3")}>
        <ListRowTitle>{label}</ListRowTitle>
        {description && (
          <ListRowDescription className="text-pretty" id={descriptionId}>
            {description}
          </ListRowDescription>
        )}
      </ListRowContent>
      <div
        className={cn(
          "flex shrink-0 items-center py-2",
          stacks && "py-0 sm:py-2",
          wide && "sm:w-75",
        )}
      >
        {children}
      </div>
    </ListRow>
  );
}

export function SwitchSettingRow({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: React.ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <SettingRow
      description={description}
      descriptionId={descriptionId}
      label={<span id={labelId}>{label}</span>}
    >
      <Switch
        aria-describedby={descriptionId}
        aria-labelledby={labelId}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </SettingRow>
  );
}
