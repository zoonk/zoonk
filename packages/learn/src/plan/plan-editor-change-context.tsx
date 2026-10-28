"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { createContext, use, useMemo, useState } from "react";

type EditorChange = { change: PlanChangeView; undone: boolean };

type EditorChangeValue = {
  latest: EditorChange | null;
  report: (change: PlanChangeView) => void;
  undo: (changeId: string) => void;
};

const EditorChangeContext = createContext<EditorChangeValue | null>(null);

export function PlanEditorChangeProvider({ children }: { children: React.ReactNode }) {
  const [latest, setLatest] = useState<EditorChange | null>(null);

  const value = useMemo<EditorChangeValue>(
    () => ({
      latest,
      // Setting back by hand what the latest change set is its Undo: the change comes back undone.
      report: (change) => setLatest({ change, undone: change.status === "undone" }),
      undo: (changeId) =>
        setLatest((current) =>
          current?.change.id === changeId ? { ...current, undone: true } : current,
        ),
    }),
    [latest],
  );

  return <EditorChangeContext value={value}>{children}</EditorChangeContext>;
}

export function useEditorChange(): EditorChange | null {
  return use(EditorChangeContext)?.latest ?? null;
}

export function useReportEditorChange(): Pick<EditorChangeValue, "report" | "undo"> {
  const value = use(EditorChangeContext);

  return { report: (change) => value?.report(change), undo: (changeId) => value?.undo(changeId) };
}
