import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
}) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className,
      )}
      data-size={size}
      data-slot="native-select-wrapper"
    >
      <select
        className="border-input bg-input/30 selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 h-9 w-full min-w-0 appearance-none rounded-4xl border py-1 pr-8 pl-3 text-sm transition-colors outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:ring-[3px] data-[size=sm]:h-8"
        data-size={size}
        data-slot="native-select"
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 select-none"
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
