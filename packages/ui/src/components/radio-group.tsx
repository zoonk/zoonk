"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { BusySpinner } from "@zoonk/ui/components/button";
import { Label } from "@zoonk/ui/components/label";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleIcon } from "lucide-react";
import { type ComponentProps, createContext, useContext, useId } from "react";

const OptionLabelContext = createContext<string | undefined>(undefined);

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("grid w-full gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

/** Base UI names a radio from its wrapping label only after hydration, so the option names it itself. */
function RadioGroupOption({ id, ...props }: ComponentProps<typeof Label>) {
  const generatedId = useId();
  const labelId = id ?? generatedId;

  return (
    <OptionLabelContext.Provider value={labelId}>
      <Label id={labelId} {...props} />
    </OptionLabelContext.Provider>
  );
}

/** A press made before the page hydrates draws it picked, its dot giving way to the spinner until the press lands. */
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  const labelId = useContext(OptionLabelContext);

  return (
    <RadioPrimitive.Root
      aria-labelledby={labelId}
      className={cn(
        "group/radio-group-item peer border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-selected data-checked:bg-selected dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area relative flex aspect-square size-4 shrink-0 rounded-full border transition-none outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px]",
        "data-held:border-selected data-held:bg-selected",
        className,
      )}
      data-slot="radio-group-item"
      // A press made before the page hydrates marks it held.
      suppressHydrationWarning
      {...props}
    >
      <RadioPrimitive.Indicator
        className="text-selected-foreground group-aria-invalid/radio-group-item:text-destructive-text flex size-full items-center justify-center group-data-held/radio-group-item:invisible! data-unchecked:invisible"
        data-slot="radio-group-indicator"
        keepMounted
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-current" />
      </RadioPrimitive.Indicator>
      <BusySpinner iconClassName="text-selected-foreground size-3" />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupOption };
