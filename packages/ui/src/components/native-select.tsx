"use client";

import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { BusyIcon } from "./button";
import type * as React from "react";

/**
 * A small select can't grow its hit area with a `::before` like `hit-area`, so it stays as tall as a
 * field and see-through while the wrapper draws the small box.
 */
const SMALL_SELECT_FRAME_CLASS = cn(
  "data-[size=sm]:before:border-input data-[size=sm]:isolate data-[size=sm]:before:pointer-events-none data-[size=sm]:before:absolute data-[size=sm]:before:inset-x-0 data-[size=sm]:before:top-1/2 data-[size=sm]:before:-z-10 data-[size=sm]:before:h-7.5 data-[size=sm]:before:-translate-y-1/2 data-[size=sm]:before:rounded-md data-[size=sm]:before:border data-[size=sm]:before:transition-colors",
  "data-[size=sm]:has-[select:hover]:before:bg-muted data-[size=sm]:has-[select:focus-visible]:before:border-ring data-[size=sm]:has-[select:focus-visible]:before:ring-ring/50 data-[size=sm]:has-[select:focus-visible]:before:ring-[3px]",
);

/** A field's look at rest, hover, focus and invalid, shared by the select and the button drawn as one. */
const FIELD_CLASS =
  "border-input bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-control min-w-0 rounded-lg border py-1 pr-8 pl-3 transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:ring-[3px]";

const CHEVRON_CLASS =
  "text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 select-none";

/** A native select has no `focusableWhenDisabled`, so it's added here to match Button. */
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
  const kept = useKeptTyping(props);

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
        className={cn(
          FIELD_CLASS,
          "selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground data-[size=sm]:text-compact w-full appearance-none select-none aria-disabled:pointer-events-none data-[size=default]:text-(length:--field-text) data-[size=sm]:rounded-md data-[size=sm]:border-transparent data-[size=sm]:bg-transparent data-[size=sm]:pr-7 data-[size=sm]:pl-2.5 data-[size=sm]:hover:bg-transparent data-[size=sm]:focus-visible:border-transparent data-[size=sm]:focus-visible:ring-0",
        )}
        data-size={size}
        data-slot="native-select"
        disabled={keepsFocus ? false : disabled}
        onChange={(event) => {
          if (!keepsFocus) {
            onChange?.(event);
          }
        }}
        {...props}
        {...kept}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className={cn(
          CHEVRON_CLASS,
          "group-data-[size=sm]/native-select:right-2 group-data-[size=sm]/native-select:size-3.5",
        )}
        data-slot="native-select-icon"
      />
    </div>
  );
}

/**
 * Drawn as a select, for a pick from a list too long for one (a country, with search) that opens
 * its own picker, so the two read as one kind of field.
 */
function NativeSelectButton({ children, className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        FIELD_CLASS,
        "relative max-w-full text-left text-(length:--field-text)",
        className,
      )}
      data-slot="native-select-button"
      type="button"
      {...props}
    >
      <span className="block truncate">{children}</span>
      <BusyIcon className={CHEVRON_CLASS}>
        <ChevronDownIcon aria-hidden="true" className="size-full" />
      </BusyIcon>
    </button>
  );
}

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

export { NativeSelect, NativeSelectButton, NativeSelectOption };
