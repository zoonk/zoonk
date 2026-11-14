"use client";

import { type ReactNode, useState } from "react";
import { ArchiveGoalDialog, type GoalStatusControl, useSetGoalStatus } from "./goal-actions";

/** A control of the caller's that archives the goal, after the dialog every archive asks through. */
export function ArchiveGoal({
  children,
  goalTitle,
  onSetStatus,
}: {
  children: (archive: { ask: () => void; pending: boolean }) => ReactNode;
  goalTitle: string;
  onSetStatus: GoalStatusControl["onSetStatus"];
}) {
  const [asking, setAsking] = useState(false);
  const { isPending, setStatus } = useSetGoalStatus(onSetStatus);

  return (
    <>
      {children({ ask: () => setAsking(true), pending: isPending })}

      <ArchiveGoalDialog
        goalTitle={goalTitle}
        onArchive={() => {
          setAsking(false);
          setStatus("archived");
        }}
        onOpenChange={setAsking}
        open={asking}
      />
    </>
  );
}
