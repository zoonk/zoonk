"use client";

import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useId } from "react";
import { useKeptTyping } from "../../use-kept-typing";

const MAX_ANSWER_LENGTH = 200;

/** Only a screen's first field takes focus. Its text stays 16px on phones, where iOS Safari zooms into smaller fields. */
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
  const kept = useKeptTyping(onChange);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        autoFocus={autoFocus}
        className="h-11 text-base md:text-[0.9375rem]"
        id={inputId}
        {...kept.field}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
