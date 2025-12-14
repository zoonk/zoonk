"use client";

import {
  Indicator as RadioGroupIndicator,
  Item as RadioGroupItem,
  Root as RadioGroupRoot,
} from "@radix-ui/react-radio-group";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

export function WizardGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      data-slot="wizard-group"
      {...props}
    />
  );
}

export function WizardField({
  className,
  ...props
}: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      className={cn("flex flex-col gap-2", className)}
      data-slot="wizard-field"
      {...props}
    />
  );
}

export function WizardLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via props when used
    <label
      className={cn(
        "font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest",
        className,
      )}
      data-slot="wizard-label"
      {...props}
    />
  );
}

export function WizardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="wizard-description"
      {...props}
    />
  );
}

export function WizardInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full border-0 bg-transparent font-bold text-3xl outline-none transition-colors placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="wizard-input"
      {...props}
    />
  );
}

export function WizardTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "field-sizing-content min-h-24 w-full resize-none border-0 bg-transparent text-xl outline-none transition-colors placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="wizard-textarea"
      {...props}
    />
  );
}

export function WizardRadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupRoot>) {
  return (
    <RadioGroupRoot
      className={cn("flex flex-col", className)}
      data-slot="wizard-radio-group"
      {...props}
    />
  );
}

export function WizardRadioGroupItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupItem>) {
  return (
    <RadioGroupItem
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-lg px-4 py-4 text-left font-semibold text-lg transition-colors",
        "hover:bg-muted",
        "data-[state=checked]:bg-foreground data-[state=checked]:text-background",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      data-slot="wizard-radio-group-item"
      {...props}
    >
      {children}

      <RadioGroupIndicator data-slot="wizard-radio-group-indicator">
        <CheckIcon aria-hidden="true" className="size-5" />
      </RadioGroupIndicator>
    </RadioGroupItem>
  );
}
