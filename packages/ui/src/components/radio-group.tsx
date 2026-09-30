"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Label } from "@zoonk/ui/components/label";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleIcon } from "lucide-react";
import { type ComponentProps, createContext, useContext, useId } from "react";

/** The id of the option label a radio sits in, which names it. */
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

/**
 * One choice: a label around its radio and whatever describes it, so the whole option picks it.
 * Base UI names a radio from a label around it only once the page hydrates, so the option names
 * its radio itself and the page reads the same before then.
 */
function RadioGroupOption({ id, ...props }: ComponentProps<typeof Label>) {
  const generatedId = useId();
  const labelId = id ?? generatedId;

  return (
    <OptionLabelContext.Provider value={labelId}>
      <Label id={labelId} {...props} />
    </OptionLabelContext.Provider>
  );
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  const labelId = useContext(OptionLabelContext);

  return (
    <RadioPrimitive.Root
      aria-labelledby={labelId}
      className={cn(
        "group/radio-group-item peer border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area relative flex aspect-square size-4 shrink-0 rounded-full border transition-none outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px]",
        className,
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="text-primary-foreground group-aria-invalid/radio-group-item:text-destructive flex size-4 items-center justify-center"
        data-slot="radio-group-indicator"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupOption };
