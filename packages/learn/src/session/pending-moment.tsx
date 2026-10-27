"use client";

import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { MomentHeader, MomentSaving, PendingMainAction } from "./moment-header";

/**
 * A task's end while its work is being saved (a block, a lesson in the session, a notebook
 * practice): its title already in place ("Lesson complete"), where the end puts it, a quiet
 * shimmering line in the readouts' place, and its main action (`action`) already in the bar,
 * waiting until the end is ready. The screen reads as done from the first frame, never as an
 * empty page, and the title never moves.
 */
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
