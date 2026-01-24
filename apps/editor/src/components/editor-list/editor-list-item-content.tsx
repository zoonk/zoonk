"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorListItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-w-0 flex-1", className)}
      data-slot="editor-list-item-content"
      {...props}
    />
  );
}
