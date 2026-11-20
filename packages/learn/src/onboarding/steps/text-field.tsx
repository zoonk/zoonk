"use client";

import { MAX_ONBOARDING_ANSWER_LENGTH } from "@zoonk/core/view-models/onboarding/onboarding-limits";
import { Input } from "@zoonk/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { useId } from "react";

/**
 * Only a screen's first field takes focus. Its text stays 16px on phones, where iOS Safari zooms
 * into smaller fields.
 */
export function TextField({
  action,
  autoFocus = true,
  description,
  inputRef,
  label,
  maxLength = MAX_ONBOARDING_ANSWER_LENGTH,
  onChange,
  onKeyDown,
  placeholder,
  required,
  value,
}: {
  /** A button at the field's end, such as one that adds what's typed. */
  action?: React.ReactNode;
  autoFocus?: boolean;
  description?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const inputId = useId();
  const descriptionId = useId();

  const inputProps = {
    "aria-describedby": description ? descriptionId : undefined,
    autoFocus,
    id: inputId,
    maxLength,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    onKeyDown,
    placeholder,
    ref: inputRef,
    required,
    value,
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="leading-5" htmlFor={inputId}>
        {label}
      </Label>
      {action ? (
        <InputGroup>
          <InputGroupInput {...inputProps} />
          <InputGroupAddon align="inline-end">{action}</InputGroupAddon>
        </InputGroup>
      ) : (
        <Input {...inputProps} />
      )}
      {description && (
        <p className="text-muted-foreground text-sm" id={descriptionId}>
          {description}
        </p>
      )}
    </div>
  );
}
