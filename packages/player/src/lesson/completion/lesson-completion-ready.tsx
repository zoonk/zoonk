"use client";

import { EnterButton } from "@zoonk/learn/enter-button";
import { FinishReady } from "@zoonk/learn/finish-ready";
import { TaskActionBar, TaskActionLabel, TaskActions, TaskBody } from "@zoonk/learn/task-layout";
import { useExtracted } from "next-intl";

/** Saved answers can resume at the end, but finishing may start memory work and needs a new tap. */
export function LessonCompletionReady({ onFinish }: { onFinish: () => void }) {
  const t = useExtracted();

  return (
    <>
      <TaskBody>
        <FinishReady />
      </TaskBody>
      <TaskActionBar>
        <TaskActions>
          <EnterButton onClick={onFinish}>
            <TaskActionLabel>{t("Finish")}</TaskActionLabel>
          </EnterButton>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
