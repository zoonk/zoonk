"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { createContext, use, useMemo, useState } from "react";

/** The plan editor's latest change, and whether the learner undid it since. */
type EditorChange = { change: PlanChangeView; undone: boolean };

type EditorChangeValue = {
  latest: EditorChange | null;
  /** A change applied from anywhere in the editor, its controls and the sheets they open. */
  report: (change: PlanChangeView) => void;
  /** A change undone from anywhere in the editor: its note says so instead of offering Undo. */
  undo: (changeId: string) => void;
};

const EditorChangeContext = createContext<EditorChangeValue | null>(null);

/**
 * Keeps the latest change made in the plan editor, so the editor can say what it did with Undo
 * (see `PlanEditorChange`), as the sheets do for theirs. Lives as long as the editor is open.
 */
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

/** The editor's latest change; null outside the editor or before its first change. */
export function useEditorChange(): EditorChange | null {
  return use(EditorChangeContext)?.latest ?? null;
}

/**
 * Tells the editor about a change applied or undone, when there is one around: outside it (a
 * sheet the Journey opens itself, onboarding's exam day card) nothing listens.
 */
export function useReportEditorChange(): Pick<EditorChangeValue, "report" | "undo"> {
  const value = use(EditorChangeContext);

  return { report: (change) => value?.report(change), undo: (changeId) => value?.undo(changeId) };
}
