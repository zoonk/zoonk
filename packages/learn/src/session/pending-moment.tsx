"use client";

import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { MomentHeader, MomentSavingTitle, PendingMainAction } from "./moment-header";

export function PendingMoment({ action }: { action: string }) {
  return (
    <>
      <TaskBody data-slot="pending-moment">
        <MomentHeader title={<MomentSavingTitle />} />
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <PendingMainAction>{action}</PendingMainAction>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
