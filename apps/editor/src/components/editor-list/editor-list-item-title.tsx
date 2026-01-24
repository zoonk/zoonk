"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorListItemTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("leading-tight font-medium", className)}
      data-slot="editor-list-item-title"
      {...props}
    />
  );
}
