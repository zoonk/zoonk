"use client";

import { cn } from "@zoonk/ui/lib/utils";

export function EditorSortableItemRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/row hover:bg-muted/50 flex items-start gap-2 px-4 py-3 transition-colors",
        className,
      )}
      data-slot="editor-sortable-item-row"
      {...props}
    />
  );
}
