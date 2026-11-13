"use client";

import { Label } from "@zoonk/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";

type SelectOption = { label: string; value: string };

/**
 * A form's select with its label over it. The options are also the select's `items`, so the
 * closed select shows the picked option's label, not its value.
 */
export function LabeledSelect({
  defaultValue,
  disabled,
  id,
  label,
  name,
  options,
  size,
  triggerClassName,
}: {
  defaultValue: string;
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  options: readonly SelectOption[];
  size?: React.ComponentProps<typeof SelectTrigger>["size"];
  triggerClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select defaultValue={defaultValue} disabled={disabled} items={options} name={name}>
        <SelectTrigger className={triggerClassName} id={id} size={size}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
