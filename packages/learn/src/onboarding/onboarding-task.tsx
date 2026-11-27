"use client";

import { Button } from "@zoonk/ui/components/button";
import { Drawer, DrawerContent, DrawerPopup } from "@zoonk/ui/components/drawer";
import { TaskLayer } from "@zoonk/ui/components/task-layer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useTaskExitAsk } from "../_components/task-close";
import { TaskHeaderTitle, type TaskSegment } from "../_components/task-header";
import { TASK_WRAPPING_ACTION_CLASS } from "../_components/task-layout";
import { TaskFrame } from "../shell/task-frame";
import { type TestQuestionTop, useOnboardingScreen } from "./onboarding-host";

const PERCENT = 100;

/**
 * A test's two ways out, behind its ✕: leave and come back to it, or end it with the answers
 * given. Offered only while stopping gives a result; before that the ✕ just leaves.
 */
function TestWaysOut({
  hint,
  onStop,
  waits = false,
}: {
  hint?: string;
  onStop: () => void;
  waits?: boolean;
}) {
  const t = useExtracted();
  const { onLeave, onOpenChange, open } = useTaskExitAsk();

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup aria-label={t("Leave")}>
        <DrawerContent
          className="flex flex-col gap-2 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          data-slot="test-ways-out"
        >
          {hint && <p className="text-muted-foreground pb-2 text-sm">{hint}</p>}

          <Button className={TASK_WRAPPING_ACTION_CLASS} onClick={onLeave} size="xl">
            {t("Finish later")}
          </Button>

          <Button
            className={TASK_WRAPPING_ACTION_CLASS}
            disabled={waits}
            focusableWhenDisabled
            onClick={() => {
              onOpenChange(false);
              onStop();
            }}
            size="xl"
            variant="outline"
          >
            {t("Stop and use my answers")}
          </Button>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

function toSegments({ answered, total }: Pick<TestQuestionTop, "answered" | "total">) {
  return Array.from({ length: Math.max(total, answered + 1) }, (_, index): TaskSegment => {
    if (index < answered) {
      return "done";
    }

    return index === answered ? "current" : "ahead";
  });
}

/**
 * `OnboardingColumn` for a test that's open: the lesson player's frame over the page the test
 * started from. A question names what it tests in the header, over one segment a question; the
 * wait and the result keep only ✕, since their own title is the screen's.
 */
export function OnboardingTaskScreen({
  backHref,
  bar,
  children,
  className,
  ...props
}: React.ComponentProps<"section"> & { backHref: string; bar?: ReactNode }) {
  const t = useExtracted();
  const { bar: top, notice } = useOnboardingScreen();
  const { test } = top;
  const stop = test?.onStop;

  return (
    <TaskLayer>
      <TaskFrame
        bar={bar}
        beforeExit={() => {
          top.onClose?.();
          return null;
        }}
        exitAsk={stop && <TestWaysOut hint={test.stopHint} onStop={stop} waits={test.stopWaits} />}
        exitHref={backHref}
        exitToApp
        headerTitle={test && <TaskHeaderTitle title={test.title} />}
        progress={
          test && {
            groups: test.groups,
            label: t("Question {number, number} of {total, number}", {
              number: test.answered + 1,
              total: test.total,
            }),
            segments: toSegments(test),
            value: test.total > 0 ? (test.answered / test.total) * PERCENT : 0,
          }
        }
      >
        {notice}

        <section
          className={cn("flex min-w-0 flex-1 flex-col gap-6", className)}
          data-slot="onboarding-column"
          {...props}
        >
          {children}
        </section>
      </TaskFrame>
    </TaskLayer>
  );
}
