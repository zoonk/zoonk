"use client";

import { FinishReady } from "@zoonk/learn/finish-ready";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
  TaskBody,
} from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";

/** Saved answers can resume at the end, but finishing may start memory work and needs a new tap. */
export function LessonCompletionReady({ onFinish }: { onFinish: () => void }) {
  const t = useExtracted();
  const finishRef = useEnterClick<HTMLButtonElement>();

  return (
    <>
      <TaskBody>
        <FinishReady />
      </TaskBody>
      <TaskActionBar>
        <TaskActions>
          <Button
            aria-keyshortcuts="Enter"
            className={TASK_MAIN_ACTION_CLASS}
            onClick={onFinish}
            ref={finishRef}
            size="xl"
          >
            {t("Finish")}
            <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
          </Button>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
