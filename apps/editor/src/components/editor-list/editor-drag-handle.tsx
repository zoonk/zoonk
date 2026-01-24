"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useContext } from "react";
import { EditorSortableItemContext } from "./editor-sortable-item-context";

export function EditorDragHandle({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  const context = useContext(EditorSortableItemContext);

  if (!context) {
    throw new Error("EditorDragHandle must be used within an EditorSortableItem.");
  }

  return (
    <button
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground active:bg-muted relative flex min-h-11 min-w-11 shrink-0 cursor-grab touch-none items-start justify-center rounded-md pt-0.5 font-mono text-sm tabular-nums transition-colors select-none before:absolute before:top-1/2 before:left-1/2 before:size-full before:min-h-11 before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 focus-visible:outline-none active:cursor-grabbing",
        className,
      )}
      data-slot="editor-drag-handle"
      type="button"
      {...context.attributes}
      {...context.listeners}
      {...props}
    >
      {typeof children === "number" ? String(children).padStart(2, "0") : children}
    </button>
  );
}
