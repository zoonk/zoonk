"use client";

import { toast } from "@zoonk/ui/components/sonner";
import { isNextRedirectError } from "@zoonk/utils/error";
import { useCallback, useMemo, useTransition } from "react";
import { EditorListContext, type EditorListContextValue } from "./editor-list-context";

export function EditorListProvider({
  children,
  onInsert,
}: {
  children: React.ReactNode;
  onInsert: (position: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  const handleInsert = useCallback(
    (position: number) => {
      startTransition(async () => {
        try {
          await onInsert(position);
        } catch (error) {
          if (!isNextRedirectError(error)) {
            console.error(`Failed to insert item at position ${position}:`, error);

            toast.error(error instanceof Error ? error.message : String(error));
          }
        }
      });
    },
    [onInsert],
  );

  const value = useMemo<EditorListContextValue>(
    () => ({
      handleInsert,
      pending,
    }),
    [handleInsert, pending],
  );

  return (
    <EditorListContext.Provider value={value}>
      <div className="relative" data-slot="editor-list">
        {children}
      </div>
    </EditorListContext.Provider>
  );
}
