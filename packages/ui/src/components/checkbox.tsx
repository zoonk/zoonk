"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { BusySpinner } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";

/** A press made before the page hydrates draws the state it asks for, its check giving way to the spinner until the press lands. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "group/checkbox peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-checked:border-selected data-checked:bg-selected data-checked:text-selected-foreground dark:bg-input/30 dark:data-checked:bg-selected dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area relative flex size-4 shrink-0 items-center justify-center rounded-sm border transition-shadow outline-none group-has-disabled/field:opacity-50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px]",
        "data-[held=checked]:border-selected! data-[held=checked]:bg-selected! data-[held=checked]:text-selected-foreground! data-[held=unchecked]:border-input! dark:data-[held=unchecked]:bg-input/30! data-[held=unchecked]:text-muted-foreground data-[held=unchecked]:bg-transparent!",
        className,
      )}
      data-slot="checkbox"
      // A press made before the page hydrates marks it held, drawn in the state it asks for.
      suppressHydrationWarning
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="grid place-content-center text-current transition-none group-data-held/checkbox:invisible! data-unchecked:invisible [&>svg]:size-3.5"
        data-slot="checkbox-indicator"
        keepMounted
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
      <BusySpinner iconClassName="size-3" />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
