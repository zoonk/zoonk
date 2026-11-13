import { Input } from "@zoonk/ui/components/input";
import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";

/**
 * A 30 px field that keeps a 44 px hit area. An input can't grow one with a `::before` like
 * `hit-area`, so it stays 44 px tall and see-through while its frame draws the box, as the shared
 * `NativeSelect size="sm"` does. `fullOnPhone` draws a whole field on a phone, where it is alone on
 * its row.
 */
export function AdminSmallInput({
  className,
  frameClassName,
  fullOnPhone,
  leading,
  ...props
}: ComponentProps<typeof Input> & {
  frameClassName?: string;
  fullOnPhone?: boolean;
  leading?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "before:border-input before:bg-background relative isolate before:pointer-events-none before:absolute before:inset-x-0 before:top-1/2 before:-z-10 before:-translate-y-1/2 before:border before:transition-colors",
        "has-[input:focus-visible]:before:border-ring has-[input:focus-visible]:before:ring-ring/50 has-[input:focus-visible]:before:ring-[3px]",
        fullOnPhone
          ? "before:h-11 before:rounded-lg md:before:h-7.5 md:before:rounded-md"
          : "before:h-7.5 before:rounded-md",
        frameClassName,
      )}
    >
      {leading}
      <Input
        className={cn(
          "rounded-md border-transparent bg-transparent focus-visible:border-transparent focus-visible:ring-0",
          className,
        )}
        {...props}
      />
    </div>
  );
}
