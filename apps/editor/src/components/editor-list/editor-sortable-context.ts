"use client";

import { createContext } from "react";

export type SortableItem = {
  id: string;
  position: number;
};

export type EditorSortableContextValue = {
  activeId: string | null;
  isDragging: boolean;
};

export const EditorSortableContext = createContext<EditorSortableContextValue | undefined>(
  undefined,
);
