"use client";

import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../../_components/step-card";
import { Steps } from "../../_components/steps";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { UndoButton } from "../../questions/undo-button";
import { DayMoment, StepWithDayMoment } from "../../session/day-moment";
import { type MomentCeremony, getCeremonyMoment } from "../../session/moment-ceremony";
import { TaskMainLink } from "../../shell/task-frame";

/**
 * What the focus test found and chose, in the learner's terms, with the tenth of Energy its
 * answers reached and the milestone it's celebrated with; null when it couldn't be saved.
 */
export type FocusTestOutcome = ProgressCelebration & {
  /** Each area asked about, named as learners call it, and whether it got the focus. */
  areas: { answers: boolean[]; chosen: boolean; label: string }[];
  /** The plan change that set the focus, for its undo; null when the focus was already this. */
  changeId: string | null;
};

/**
 * One short segment per answer, blue when right and red when wrong, as a task's header draws
 * them, and how many were right in numbers: an area's result at a glance.
 */
function AnswerSegments({ answers }: { answers: readonly boolean[] }) {
  const t = useExtracted();
  const correct = answers.filter(Boolean).length;

  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <span aria-hidden="true" className="flex h-1 w-16 gap-[3px]">
        {answers.map((isCorrect, index) => (
          <span
            className={cn("min-w-0 flex-1 rounded-xs", isCorrect ? "bg-success" : "bg-destructive")}
            // oxlint-disable-next-line react/no-array-index-key -- answers have no identity but their order.
            key={index}
          />
        ))}
      </span>
      <span
        aria-hidden="true"
        className="text-muted-foreground w-8 text-right font-mono text-xs tabular-nums"
      >
        {`${correct}/${answers.length}`}
      </span>
      <span className="sr-only">
        {t(
          "{correct, plural, =0 {# of {total, number} right} one {# of {total, number} right} other {# of {total, number} right}}",
          { correct, total: answers.length },
        )}
      </span>
    </span>
  );
}

/** Each area asked about, with its answers as segments, then what the test did to the day. */
function AreasStep({ buddy, outcome }: { buddy?: LearnBuddy | null; outcome: FocusTestOutcome }) {
  const t = useExtracted();

  return (
    <StepWithDayMoment
      dayMoment={
        <DayMoment
          buddy={buddy}
          ceremony={outcome.ceremony}
          missionMoment={null}
          reached={outcome.reached}
        />
      }
    >
      <StepCard>
        <StepHeader>
          <StepTitle>{t("How you did")}</StepTitle>
        </StepHeader>
        <StepRows>
          {outcome.areas.map((area) => (
            <StepRow key={area.label}>
              <span className="min-w-0 flex-1 leading-snug">{area.label}</span>
              <AnswerSegments answers={area.answers} />
            </StepRow>
          ))}
        </StepRows>
      </StepCard>
    </StepWithDayMoment>
  );
}

/** The focus it set and why, in one sentence. */
function FocusStep({ outcome, undone }: { outcome: FocusTestOutcome; undone: boolean }) {
  const t = useExtracted();
  const format = useFormatter();
  const chosen = outcome.areas.filter((area) => area.chosen).map((area) => area.label);

  if (undone) {
    return (
      <StepCard aria-live="polite" role="status">
        <StepHeader>
          <StepTitle>{t("Your plan is back as it was")}</StepTitle>
        </StepHeader>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("Your new focus")}</StepEyebrow>
        <StepTitle>{format.list(chosen)}</StepTitle>
        <StepDetail>
          {t(
            "{count, plural, one {This subject counts a lot, and it's where you missed most.} other {These subjects count a lot, and they're where you missed most.}} Your plan now gives {count, plural, one {it} other {them}} more depth, and every other topic stays in it.",
            { count: chosen.length },
          )}
        </StepDetail>
      </StepHeader>
    </StepCard>
  );
}

/**
 * The focus test's result, one thing at a time: how each area went, then the focus it set and
 * why, with the plan as the way on and an undo for the focus. A milestone it earned opens first,
 * on its own.
 */
export function FocusTestResult({
  buddy,
  closeHref,
  doneHref,
  onUndo,
  outcome,
  renderCeremony,
}: {
  buddy?: LearnBuddy | null;
  closeHref: string;
  doneHref: string;
  onUndo: (changeId: string) => Promise<boolean>;
  outcome: FocusTestOutcome;
  renderCeremony?: MomentCeremony;
}) {
  const t = useExtracted();
  const [undo, setUndo] = useState<"done" | "failed" | null>(null);
  const [isPending, startTransition] = useTransition();
  const { changeId } = outcome;

  const runUndo = () => {
    if (!changeId) {
      return;
    }

    startTransition(async () => {
      const done = await onUndo(changeId).catch(() => false);
      setUndo(done ? "done" : "failed");
    });
  };

  const items = [
    {
      content: <AreasStep buddy={buddy} outcome={outcome} />,
      id: "areas",
      moment: getCeremonyMoment({ milestone: outcome.ceremony, render: renderCeremony }),
    },
    outcome.areas.some((area) => area.chosen) && {
      content: <FocusStep outcome={outcome} undone={undo === "done"} />,
      id: "focus",
    },
  ].filter((item) => item !== false);

  return (
    <Steps
      exitHref={closeHref}
      finalAction={<TaskMainLink href={doneHref}>{t("See your plan")}</TaskMainLink>}
      finalOptions={
        changeId && undo !== "done" ? (
          <UndoButton failed={undo === "failed"} onUndo={runUndo} pending={isPending} />
        ) : null
      }
      items={items}
    />
  );
}
