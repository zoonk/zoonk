"use client";

import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../_components/save-error";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMainButton } from "../shell/task-frame";
import { MomentHeader } from "./moment-header";

/**
 * A task's end whose save didn't go through (a lesson, in the player or as one of the day's
 * blocks): its title in place, the shared line saying the answers are kept, and Try again as the
 * screen's one main action, in the bar where the end's own would be.
 */
export function FailedMoment({ onRetry, title }: { onRetry: () => void; title: string }) {
  const t = useExtracted();

  return (
    <>
      <TaskBody data-slot="failed-moment">
        <MomentHeader title={title}>
          <AnswersSaveError />
        </MomentHeader>
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <TaskMainButton onClick={onRetry}>{t("Try again")}</TaskMainButton>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
