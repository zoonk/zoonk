import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

function WizardInput({ className, ...props }: React.ComponentProps<"input">) {
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

function WizardTextarea({
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

function WizardLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via props when used
    <label
      className={cn(
        "font-medium text-muted-foreground text-xs uppercase tracking-widest",
        className,
      )}
      data-slot="wizard-label"
      {...props}
    />
  );
}

function WizardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="wizard-description"
      {...props}
    />
  );
}

export { WizardDescription, WizardInput, WizardLabel, WizardTextarea };
