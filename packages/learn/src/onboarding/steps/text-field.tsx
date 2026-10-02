"use client";

import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useId } from "react";

const MAX_ANSWER_LENGTH = 200;

/** Only a screen's first field takes focus; the others wait for the learner. */
export function TextField({
  autoFocus = true,
  label,
  onChange,
  placeholder,
  value,
}: {
  autoFocus?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        autoFocus={autoFocus}
        className="in-data-[mode=fun]:fun-glass h-12 text-base"
        id={inputId}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
