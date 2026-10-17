"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { ListRow, ListRowContent, ListRowDescription, ListRowTitle } from "./list-group";

/**
 * A setting as a row of its page's list, as Linear lays settings out: its name with what it does
 * under it on the left, its control on the right (a switch, a 30px select or button). No icon: the
 * names are short and unique. A wide control (`wide`, a text field) goes under the name on a phone
 * and to the right from a tablet up.
 */
export function SettingRow({
  children,
  className,
  description,
  descriptionId,
  label,
  wide = false,
}: {
  /** The control. */
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  descriptionId?: string;
  /** The setting's name: a `label` for a field, or text the control names itself with. */
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

/** A setting turned on or off: its name, what it does under it, and the switch at the row's end. */
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

/**
 * A setting picked from a list: its name, what it does under it, and a 30px select at the row's
 * end at every size. `children` is the select (`size="sm"`), named by the label (`selectId`) and
 * described by `descriptionId`.
 */
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
