"use client";

import { MAX_ONBOARDING_ANSWER_LENGTH } from "@zoonk/core/view-models/onboarding/onboarding-limits";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { useId } from "react";

/**
 * Only a screen's first field takes focus. Its text stays 16px on phones, where iOS Safari zooms
 * into smaller fields.
 */
export function TextField({
  autoFocus = true,
  description,
  label,
  maxLength = MAX_ONBOARDING_ANSWER_LENGTH,
  onChange,
  placeholder,
  required,
  value,
}: {
  autoFocus?: boolean;
  description?: React.ReactNode;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const inputId = useId();
  const descriptionId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        aria-describedby={description ? descriptionId : undefined}
        autoFocus={autoFocus}
        className="md:text-reading h-11 text-base"
        id={inputId}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
      {description && (
        <p className="text-muted-foreground text-sm" id={descriptionId}>
          {description}
        </p>
      )}
    </div>
  );
}
