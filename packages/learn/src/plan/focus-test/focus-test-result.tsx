"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CrosshairIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { KindTile } from "../../_components/kind-tile";
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
import { UndoButton } from "../../questions/undo-button";
import { TaskMainLink } from "../../shell/task-frame";

/** What the focus test found and chose, in the learner's terms; null when it couldn't be saved. */
export type FocusTestOutcome = {
  /** Each area asked about, named as learners call it, and whether it got the focus. */
  areas: { answers: boolean[]; chosen: boolean; label: string }[];
  /** The plan change that set the focus, for its undo; null when the focus was already this. */
  changeId: string | null;
};

/** One dot per answer, filled when right: an area's result at a glance. */
function AnswerDots({ answers }: { answers: readonly boolean[] }) {
  const t = useExtracted();
  const correct = answers.filter(Boolean).length;

  return (
    <span className="flex shrink-0 items-center gap-1">
      {answers.map((isCorrect, index) => (
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 rounded-full",
            isCorrect ? "bg-success" : "bg-muted-foreground/25",
          )}
          // oxlint-disable-next-line react/no-array-index-key -- answers have no identity but their order.
          key={index}
        />
      ))}
      <span className="sr-only">
        {t("{correct, number} of {total, number} right", { correct, total: answers.length })}
      </span>
    </span>
  );
}

/** Each area asked about, with its answers as dots. */
function AreasStep({ outcome }: { outcome: FocusTestOutcome }) {
  const t = useExtracted();

  return (
    <StepCard>
      <KindTile icon={CrosshairIcon} kind="challenge" size="lg" />
      <StepHeader>
        <StepTitle>{t("How you did")}</StepTitle>
      </StepHeader>
      <StepRows>
        {outcome.areas.map((area) => (
          <StepRow key={area.label}>
            <span className="min-w-0 flex-1 leading-snug">{area.label}</span>
            <AnswerDots answers={area.answers} />
          </StepRow>
        ))}
      </StepRows>
    </StepCard>
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
        <KindTile icon={CrosshairIcon} kind="challenge" size="lg" />
        <StepHeader>
          <StepTitle>{t("Your plan is back as it was")}</StepTitle>
        </StepHeader>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <KindTile icon={CrosshairIcon} kind="challenge" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Your new focus")}</StepEyebrow>
        <StepTitle className="text-2xl sm:text-3xl">{format.list(chosen)}</StepTitle>
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
 * why, with the plan as the way on and an undo for the focus.
 */
export function FocusTestResult({
  closeHref,
  doneHref,
  onUndo,
  outcome,
}: {
  closeHref: string;
  doneHref: string;
  onUndo: (changeId: string) => Promise<boolean>;
  outcome: FocusTestOutcome;
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
    { content: <AreasStep outcome={outcome} />, id: "areas" },
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
