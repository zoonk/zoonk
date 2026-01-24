"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorListItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground mt-0.5 line-clamp-2 text-sm", className)}
      data-slot="editor-list-item-description"
      {...props}
    />
  );
}
