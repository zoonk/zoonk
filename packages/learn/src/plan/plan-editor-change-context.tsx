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

/** What an opening of the editor (`open`) shows: the change its own last save made. */
type Opening = { change: EditorChange | null; count: number; open: boolean };

/**
 * A save reports to the opening it was made in, so one that lands after the learner closed and
 * reopened the editor neither shows in the new opening nor replaces what that opening shows.
 */
export function PlanEditorChangeProvider({
  children,
  open,
}: {
  children: React.ReactNode;
  open: boolean;
}) {
  const [opening, setOpening] = useState<Opening>({ change: null, count: 0, open });

  if (open !== opening.open) {
    setOpening(open ? { change: null, count: opening.count + 1, open } : { ...opening, open });
  }

  const { change: latest, count } = opening;

  const value = useMemo<EditorChangeValue>(
    () => ({
      latest,
      // Setting back by hand what the latest change set is its Undo: the change comes back undone.
      report: (change) =>
        setOpening((current) =>
          current.count === count
            ? { ...current, change: { change, undone: change.status === "undone" } }
            : current,
        ),
      undo: (changeId) =>
        setOpening((current) =>
          current.change?.change.id === changeId
            ? { ...current, change: { ...current.change, undone: true } }
            : current,
        ),
    }),
    [count, latest],
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
