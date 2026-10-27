"use client";

import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { AnswersSaveError } from "../_components/save-error";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { MomentHeader } from "./moment-header";

/**
 * A task's end whose save didn't go through (a lesson, in the player or as one of the day's
 * blocks): its title in place, the shared line saying the answers are kept, and Try again as the
 * screen's one main action, in the bar where the end's own would be, pressed by Enter too.
 */
export function FailedMoment({ onRetry, title }: { onRetry: () => void; title: string }) {
  const t = useExtracted();

  useEnterKey(onRetry);

  return (
    <>
      <TaskBody data-slot="failed-moment">
        <MomentHeader title={title}>
          <AnswersSaveError />
        </MomentHeader>
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <EnterButton onClick={onRetry}>{t("Try again")}</EnterButton>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
