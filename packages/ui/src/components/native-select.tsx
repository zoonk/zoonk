import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

/**
 * The small select (`size="sm"`), as tall as a small button (30px) beside a row's text: its line,
 * its hover and its focus ring are drawn by the wrapper, centered on the select, which stays 44px
 * tall and see-through so it's as easy to press as any target (a select can't widen itself with a
 * `::before` the way `hit-area` does). `isolate` keeps the drawn box under the select's words in
 * any surroundings.
 */
const SMALL_SELECT_FRAME_CLASS = cn(
  "data-[size=sm]:before:border-input data-[size=sm]:isolate data-[size=sm]:before:pointer-events-none data-[size=sm]:before:absolute data-[size=sm]:before:inset-x-0 data-[size=sm]:before:top-1/2 data-[size=sm]:before:-z-10 data-[size=sm]:before:h-7.5 data-[size=sm]:before:-translate-y-1/2 data-[size=sm]:before:rounded-md data-[size=sm]:before:border data-[size=sm]:before:transition-colors",
  "data-[size=sm]:has-[select:hover]:before:bg-muted data-[size=sm]:has-[select:focus-visible]:before:border-ring data-[size=sm]:has-[select:focus-visible]:before:ring-ring/50 data-[size=sm]:has-[select:focus-visible]:before:ring-[3px]",
);

/**
 * `focusableWhenDisabled` works as it does on Button for a controlled select: one that waits on a
 * save stays in the tab order as `aria-disabled` and ignores changes, so keyboard focus isn't
 * dropped to the page.
 */
function NativeSelect({
  className,
  disabled,
  focusableWhenDisabled = false,
  onChange,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  focusableWhenDisabled?: boolean;
  size?: "sm" | "default";
}) {
  const keepsFocus = Boolean(disabled) && focusableWhenDisabled;

  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50 has-[select[aria-disabled=true]]:opacity-50",
        SMALL_SELECT_FRAME_CLASS,
        className,
      )}
      data-size={size}
      data-slot="native-select-wrapper"
    >
      <select
        aria-disabled={keepsFocus || undefined}
        className="border-input bg-input/30 selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 h-11 w-full min-w-0 appearance-none rounded-lg border py-1 pr-8 pl-3 text-sm transition-colors outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-invalid:ring-[3px] data-[size=sm]:rounded-md data-[size=sm]:border-transparent data-[size=sm]:bg-transparent data-[size=sm]:pr-7 data-[size=sm]:pl-2.5 data-[size=sm]:text-[0.8125rem] data-[size=sm]:hover:bg-transparent data-[size=sm]:focus-visible:border-transparent data-[size=sm]:focus-visible:ring-0 dark:data-[size=sm]:bg-transparent dark:data-[size=sm]:hover:bg-transparent"
        data-size={size}
        data-slot="native-select"
        disabled={keepsFocus ? false : disabled}
        onChange={(event) => {
          if (!keepsFocus) {
            onChange?.(event);
          }
        }}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 select-none group-data-[size=sm]/native-select:right-2 group-data-[size=sm]/native-select:size-3.5"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return <optgroup className={cn(className)} data-slot="native-select-optgroup" {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
