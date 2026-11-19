"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Off is quiet, a pale track with its knob at the start; on is the text color. The knob's place says
 * the state, so the off track turns dark only when the device asks for more contrast.
 */
function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & { size?: "sm" | "default" }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer group/switch focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:bg-primary data-unchecked:bg-foreground/15 contrast-more:data-unchecked:bg-foreground/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 hit-area relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-[3px] aria-invalid:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] forced-colors:data-checked:bg-[color:Highlight]",
        className,
      )}
      data-size={size}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="bg-background dark:data-unchecked:bg-muted-foreground pointer-events-none block rounded-full shadow-xs ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:shadow-none forced-colors:bg-[color:ButtonText]!"
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
