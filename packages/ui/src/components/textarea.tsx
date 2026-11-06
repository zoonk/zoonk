"use client";

import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";
import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

/** A field waiting on its submit takes `readOnly`, not `disabled`, so keyboard focus isn't dropped to the page. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const kept = useKeptTyping(props);

  return (
    <textarea
      className={cn(
        "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-16 w-full resize-none rounded-lg border px-3 py-3 text-base transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px] md:text-sm",
        className,
      )}
      data-slot="textarea"
      {...props}
      {...kept}
    />
  );
}

export { Textarea };
