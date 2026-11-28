"use client";

import { Button } from "@zoonk/ui/components/button";
import { Drawer, DrawerCloseButton, DrawerContent, DrawerPopup } from "@zoonk/ui/components/drawer";
import { TaskLayer } from "@zoonk/ui/components/task-layer";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { useTaskExitAsk } from "../_components/task-close";
import { TaskHeaderTitle, type TaskSegment } from "../_components/task-header";
import { useTestFacts } from "../placement-test/use-test-facts";
import { TaskFrame } from "../shell/task-frame";
import { type TestQuestionTop, useOnboardingScreen } from "./onboarding-host";

const PERCENT = 100;

/** The set's button height for the pointer in use, growing only when a long label wraps. */
const WAY_OUT_CLASS =
  "h-auto min-h-control max-w-full py-2 text-center text-balance whitespace-normal";

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
        <div className="flex justify-end px-6 pt-3 sm:pt-5">
          <DrawerCloseButton label={t("Close")} />
        </div>

        <DrawerContent
          className="flex flex-col gap-2 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          data-slot="test-ways-out"
        >
          {hint && <p className="text-muted-foreground pb-2 text-sm">{hint}</p>}

          <Button className={WAY_OUT_CLASS} onClick={onLeave} size="lg">
            {t("Finish later")}
          </Button>

          <Button
            className={WAY_OUT_CLASS}
            disabled={waits}
            focusableWhenDisabled
            onClick={() => {
              onOpenChange(false);
              onStop();
            }}
            size="lg"
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
  const facts = useTestFacts();
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
            label: facts.question({ number: test.answered + 1, total: test.total }),
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
