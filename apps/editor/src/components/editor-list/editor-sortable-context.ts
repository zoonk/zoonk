"use client";

import { createContext } from "react";

export type SortableItem = {
  id: number;
  position: number;
};

export type EditorSortableContextValue = {
  activeId: number | null;
  isDragging: boolean;
};

export const EditorSortableContext = createContext<EditorSortableContextValue | undefined>(
  undefined,
);
