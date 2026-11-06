"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";
import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

/** A field waiting on its submit takes `readOnly`, not `disabled`, so keyboard focus isn't dropped to the page. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const kept = useKeptTyping(props);

  return (
    <InputPrimitive
      className={cn(
        "border-input bg-background file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-11 w-full min-w-0 rounded-lg border px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px] md:text-sm",
        className,
      )}
      data-slot="input"
      type={type}
      {...props}
      {...kept}
    />
  );
}

function InputError({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-destructive-text text-sm", className)}
      data-slot="input-error"
      {...props}
    />
  );
}

export { Input, InputError };
