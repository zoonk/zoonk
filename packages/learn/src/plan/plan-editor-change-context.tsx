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

/**
 * A change shows only in the opening of the editor (`open`) whose save made it, so a save that
 * lands after the learner closed and reopened the editor shows nothing in the new one.
 */
export function PlanEditorChangeProvider({
  children,
  open,
}: {
  children: React.ReactNode;
  open: boolean;
}) {
  const [opening, setOpening] = useState({ count: 0, open });
  const [reported, setReported] = useState<(EditorChange & { opening: number }) | null>(null);

  if (open !== opening.open) {
    setOpening({ count: opening.count + (open ? 1 : 0), open });
  }

  const latest = reported?.opening === opening.count ? reported : null;

  const value = useMemo<EditorChangeValue>(
    () => ({
      latest,
      // Setting back by hand what the latest change set is its Undo: the change comes back undone.
      report: (change) =>
        setReported({ change, opening: opening.count, undone: change.status === "undone" }),
      undo: (changeId) =>
        setReported((current) =>
          current?.change.id === changeId ? { ...current, undone: true } : current,
        ),
    }),
    [latest, opening.count],
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
