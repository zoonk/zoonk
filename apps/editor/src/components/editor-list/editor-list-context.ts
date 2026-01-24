"use client";

import { createContext, useContext } from "react";

export type EditorListContextValue = {
  pending: boolean;
  handleInsert: (position: number) => void;
};

export const EditorListContext = createContext<EditorListContextValue | undefined>(undefined);

export function useEditorList() {
  const context = useContext(EditorListContext);
  if (!context) {
    throw new Error("EditorList components must be used within an EditorListProvider.");
  }
  return context;
}
