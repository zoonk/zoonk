"use client";

import { Checkbox } from "@zoonk/ui/components/checkbox";
import { Label } from "@zoonk/ui/components/label";

type CategoryOptionProps = {
  category: string;
  isSelected: boolean;
  label: string;
  onToggle: (category: string, isSelected: boolean) => void;
};

export function CategoryOption({ category, isSelected, label, onToggle }: CategoryOptionProps) {
  return (
    <Label className="hover:bg-muted cursor-pointer rounded-lg px-2 py-1.5">
      <Checkbox checked={isSelected} onCheckedChange={() => onToggle(category, isSelected)} />
      {label}
    </Label>
  );
}
