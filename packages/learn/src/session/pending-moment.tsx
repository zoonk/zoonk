"use client";

import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { MomentHeader, MomentSaving, PendingMainAction } from "./moment-header";

export function PendingMoment({ action, title }: { action: string; title: string }) {
  return (
    <>
      <TaskBody data-slot="pending-moment">
        <MomentHeader title={title}>
          <MomentSaving />
        </MomentHeader>
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <PendingMainAction>{action}</PendingMainAction>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
