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
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  descriptionId?: string;
  label: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <ListRow
      className={cn(
        "items-center gap-x-4",
        wide && "flex-col items-stretch gap-y-0 pb-3 sm:flex-row sm:items-center sm:pb-0",
        className,
      )}
    >
      <ListRowContent className={cn(wide && "sm:py-3")}>
        <ListRowTitle>{label}</ListRowTitle>
        {description && (
          <ListRowDescription className="text-pretty" id={descriptionId}>
            {description}
          </ListRowDescription>
        )}
      </ListRowContent>
      <div className={cn("flex shrink-0 items-center", wide && "sm:w-75")}>{children}</div>
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

export function SelectSettingRow({
  children,
  description,
  descriptionId,
  label,
  selectId,
}: {
  children: React.ReactNode;
  description: string;
  descriptionId: string;
  label: string;
  selectId: string;
}) {
  return (
    <SettingRow
      description={description}
      descriptionId={descriptionId}
      label={<label htmlFor={selectId}>{label}</label>}
    >
      {children}
    </SettingRow>
  );
}
