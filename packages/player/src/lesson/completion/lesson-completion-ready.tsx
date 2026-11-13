"use client";

import { FinishReady } from "@zoonk/learn/finish-ready";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActionLabel,
  TaskActions,
  TaskBody,
} from "@zoonk/learn/task-layout";
import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
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
            aria-keyshortcuts={shortcutKeys("main")}
            className={TASK_MAIN_ACTION_CLASS}
            onClick={onFinish}
            ref={finishRef}
            size="xl"
          >
            <TaskActionLabel>{t("Finish")}</TaskActionLabel>
            <ShortcutKbd shortcut="main" tone="inverse" />
          </Button>
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
