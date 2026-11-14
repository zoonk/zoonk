"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useTransition } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import { ExamOverActions } from "../plan/exam-over-actions";
import { STUDY_AFTER_EXAM } from "../plan/plan-full-course";
import { TodayBar } from "./today-bar";
import { useTodayScreen } from "./today-context";

export function TodayExamOver() {
  const { actions, today } = useTodayScreen();
  const saveFailed = useChangeSaveFailed();
  const [isPending, startTransition] = useTransition();

  const keepStudying = () => {
    startTransition(async () => {
      const { data: change } = await safeAsync(() => actions.changePlan(STUDY_AFTER_EXAM));

      if (!change) {
        saveFailed();
        return;
      }

      await safeAsync(async () => actions.refresh());
    });
  };

  return (
    <TodayBar>
      <ExamOverActions
        goalTitle={today.goal.displayName}
        keeping={isPending}
        onArchive={async () => ((await actions.archiveGoal()) ? "saved" : "failed")}
        onKeepStudying={keepStudying}
      />
    </TodayBar>
  );
}
