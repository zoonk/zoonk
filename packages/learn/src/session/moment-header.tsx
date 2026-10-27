"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { StepDetail, StepHeader } from "../_components/step-card";
import { TASK_MAIN_ACTION_CLASS } from "../_components/task-layout";
import { isFocusLost } from "../_utils/is-focus-lost";
import { MOMENT_TITLE_PROPS } from "./moment-ceremony";

/**
 * The head every task's end opens with (a block, a lesson, a notebook practice, a drill, a round, a
 * quick explanation): its title saying what happened, with an eyebrow over it and one quiet line
 * under it where the end has one, then 24px under them what the work earned (`MomentReadouts`),
 * or while it saves, a quiet line in their place (`MomentSaving`), so the title never moves. The
 * title takes the focus the last answer's Continue took with it, or a closed ceremony's
 * (`MOMENT_TITLE_PROPS`), so a screen reader starts here and reads on.
 *
 * ```tsx
 * <MomentHeader title="Practice done">
 *   <MomentReadouts brainPower={18} score={{ answered: 5, correct: 4 }} />
 * </MomentHeader>
 * ```
 */
export function MomentHeader({
  children,
  detail,
  eyebrow,
  title,
}: {
  children?: React.ReactNode;
  detail?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isFocusLost(document.activeElement)) {
      heading.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="flex flex-col items-start gap-6" data-slot="moment-header" role="status">
      <StepHeader>
        {eyebrow}
        <h2 className="text-title outline-none" ref={heading} {...MOMENT_TITLE_PROPS}>
          {title}
        </h2>
        {detail && <StepDetail className="text-pretty">{detail}</StepDetail>}
      </StepHeader>

      {children}
    </div>
  );
}

/**
 * What a task's end shows in its readouts' place while its work is being saved: one quiet
 * shimmering line, the one sign of the wait, as far under the title as the readouts land.
 */
export function MomentSaving() {
  const t = useExtracted();

  return <p className="text-muted-foreground shimmer text-sm">{t("Saving your progress…")}</p>;
}

/** A task's end whose work couldn't be saved: it says so in the readouts' place, with a retry. */
export function MomentSaveFailed({ onRetry }: { onRetry: () => void }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col items-start gap-3" role="alert">
      <p className="text-sm">{t("We couldn't save your progress yet.")}</p>
      <Button onClick={onRetry} size="lg" variant="outline">
        {t("Try again")}
      </Button>
    </div>
  );
}

/**
 * A task's end's main action while its work saves, in its place in the bar: its label, waiting
 * until the result is ready. The line above says why, so it shows no spinner of its own.
 */
export function PendingMainAction({ children }: { children: React.ReactNode }) {
  return (
    <Button aria-busy className={TASK_MAIN_ACTION_CLASS} disabled focusableWhenDisabled size="xl">
      {children}
    </Button>
  );
}
