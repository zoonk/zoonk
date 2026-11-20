"use client";

import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { Textarea } from "@zoonk/ui/components/textarea";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";

export function Choice({
  choices,
  className,
  defaultValue,
  label,
  name,
}: {
  choices: { label: string; value: string }[];
  className?: string;
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      className={cn("flex flex-wrap gap-x-6 gap-y-3", className)}
      defaultValue={defaultValue}
      name={name}
      required
    >
      {choices.map((choice) => (
        <RadioGroupOption className="min-h-6 font-normal" key={choice.value}>
          <RadioGroupItem value={choice.value} />
          {choice.label}
        </RadioGroupOption>
      ))}
    </RadioGroup>
  );
}

export function TextField({
  label,
  name,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        className="min-h-11"
        id={id}
        name={name}
        placeholder={placeholder}
        required={required}
        rows={1}
      />
    </div>
  );
}
