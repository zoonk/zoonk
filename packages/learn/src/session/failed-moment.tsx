"use client";

import { useExtracted } from "next-intl";
import { AnswersSaveError } from "../_components/save-error";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMainButton } from "../shell/task-frame";
import { MomentHeader } from "./moment-header";

export function FailedMoment({
  failures,
  kept,
  onRetry,
  title,
}: {
  failures: number;
  kept?: boolean;
  onRetry: () => void;
  title?: string;
}) {
  const t = useExtracted();

  return (
    <>
      <TaskBody data-slot="failed-moment">
        <MomentHeader title={title ?? t("Your lesson isn't saved yet")}>
          <AnswersSaveError failures={failures} kept={kept} />
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
