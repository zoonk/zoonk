"use client";

import { type useSortable } from "@dnd-kit/sortable";
import { createContext } from "react";

export type SortableItemContextValue = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};

export const EditorSortableItemContext = createContext<SortableItemContextValue | undefined>(
  undefined,
);
