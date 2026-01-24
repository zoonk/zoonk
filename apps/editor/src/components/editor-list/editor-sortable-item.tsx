"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@zoonk/ui/lib/utils";
import { useMemo } from "react";
import {
  EditorSortableItemContext,
  type SortableItemContextValue,
} from "./editor-sortable-item-context";

export function EditorSortableItem({ children, id }: { children: React.ReactNode; id: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const contextValue = useMemo<SortableItemContextValue>(
    () => ({ attributes, listeners }),
    [attributes, listeners],
  );

  return (
    <div
      className={cn(isDragging && "opacity-50")}
      data-dragging={isDragging}
      data-slot="editor-sortable-item"
      ref={setNodeRef}
      style={style}
    >
      <EditorSortableItemContext.Provider value={contextValue}>
        {children}
      </EditorSortableItemContext.Provider>
    </div>
  );
}
