"use client";

import {
  Indicator as RadixRadioGroupIndicator,
  Item as RadixRadioGroupItem,
  Root as RadixRadioGroupRoot,
} from "@radix-ui/react-radio-group";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleIcon } from "lucide-react";
import type * as React from "react";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadixRadioGroupRoot>) {
  return (
    <RadixRadioGroupRoot
      className={cn("grid gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadixRadioGroupItem>) {
  return (
    <RadixRadioGroupItem
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadixRadioGroupIndicator
        className="relative flex items-center justify-center"
        data-slot="radio-group-indicator"
      >
        <CircleIcon className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-2 fill-primary" />
      </RadixRadioGroupIndicator>
    </RadixRadioGroupItem>
  );
}

export { RadioGroup, RadioGroupItem };
