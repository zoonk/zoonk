"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { getEditorSectionId } from "./plan-editor-sections";
import { PlanFailedMessage } from "./plan-failed-message";
import { usePlanChange } from "./use-plan-change";
import { useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/** Below half a percent, the share would read "0%". */
const MIN_SHOWN_SHARE = 0.005;

/**
 * How far the learner's own time goes before their date, exactly as their plan has it. Null when
 * the plan covers everything in depth or has no date to cover it by. What other daily times or
 * dates would do is the learner's to ask for (see `useTimeToCover`).
 */
export function usePlanCoverage() {
  const { plan } = usePlanScreen();
  const { feasibility } = plan;

  if (!feasibility?.deadline || feasibility.fits) {
    return null;
  }

  return {
    coreFits: feasibility.coreFits,
    coveredShare: feasibility.coveredShare,
    deepensMostAsked: feasibility.deepensMostAsked,
    measure: feasibility.measure,
  };
}

/**
 * Whether the learner's own time already covers the whole goal by its date (`timeCovers`): what
 * the plan still leaves out comes at their time then (the plan's `fitOffer`), never as another
 * daily time.
 */
export function useTimeEnough(): boolean {
  const { plan } = usePlanScreen();
  return plan.feasibility?.timeCovers ?? false;
}

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

type CoveredProps = Pick<Coverage, "coreFits" | "coveredShare" | "deepensMostAsked" | "measure">;

/**
 * What the learner's own time covers: every topic (for an exam, of the exam; for any other goal,
 * every part of it), the ones that count most in more depth (for an exam, only when the topics it
 * asks most really keep more of theirs); or, when even that doesn't fit, what the plan's cut
 * leaves out: an exam's least asked topics (or, studying everything, that they come after the
 * exam, since nothing is left out then), and for any other goal what its path reaches last.
 */
export function useCoveredText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const time = formatDuration(plan.schedule.dailyMinutes);
  const { fullCourse } = plan.schedule;

  return ({ coreFits, coveredShare, deepensMostAsked, measure }: CoveredProps): string => {
    // Next to nothing fits: a sentence about depth would say nothing a learner can use.
    if (coveredShare < MIN_SHOWN_SHARE) {
      return t("{time} a day isn't enough time to cover your goal.", { time });
    }

    if (coreFits && measure === "exam") {
      return deepensMostAsked
        ? t(
            "{time} a day studies every topic of the exam, the ones that come up most in more depth.",
            { time },
          )
        : t("{time} a day studies every topic of the exam, some of them in less depth.", { time });
    }

    if (coreFits) {
      return t(
        "{time} a day studies every part of your goal, the ones that matter most in more depth.",
        { time },
      );
    }

    if (measure === "exam" && fullCourse) {
      return t(
        "{time} a day doesn't reach every topic by the exam: the ones that come up least come after it.",
        { time },
      );
    }

    return measure === "exam"
      ? t("{time} a day doesn't reach every topic: the ones that come up least are left out.", {
          time,
        })
      : t(
          "{time} a day doesn't reach every part of your goal: what comes last in your path is left out.",
          { time },
        );
  };
}

export function CoveredSentence(props: CoveredProps) {
  const coveredText = useCoveredText();
  return <p>{coveredText(props)}</p>;
}

/**
 * "Move your date to cover everything", for a goal that isn't an exam, whose own time falls short
 * by its date (and doesn't cover everything once planned again: `useTimeEnough`). Once Find found
 * no date that does, a tap says so at once from that answer, with no search: the control stays,
 * so its message (and the keyboard's place) stays with it.
 */
export function useCanMoveDate(): boolean {
  const { goal } = usePlanScreen();
  const coverage = usePlanCoverage();
  const timeEnough = useTimeEnough();
  return goal.kind !== "exam" && coverage !== null && !timeEnough;
}

/** Why moving the date didn't work: the plan was being built, or no date covers everything. */
type MoveOutcome = "building" | "failed" | "noDate" | null;

/**
 * One tap moves a goal's date to the earliest day the learner's own time covers everything by:
 * the date Find found for this plan, found first when it hasn't been (the same search, shared with
 * Find: see `useTimeToCover`), then saved as any change (S1: no endpoint of its own), through
 * `planChange` when the section saves one change at a time. A plan that changed while it searched
 * moves nothing: the date was for the plan before. `onMoved` hears when the move was saved.
 */
export function useMoveDate({
  onMoved,
  onMoving,
  planChange,
}: {
  onMoved?: () => void;
  /** Hears when the move starts finding its date and when it's done, saved or not. */
  onMoving?: (moving: boolean) => void;
  planChange?: ReturnType<typeof usePlanChange>;
} = {}) {
  const own = usePlanChange();
  const { change, failed, isPending } = planChange ?? own;
  const { changes, keepFocus } = usePlanScreen();
  const { find } = useTimeToCover();
  const [finding, setFinding] = useState(false);
  const [outcome, setOutcome] = useState<MoveOutcome>(null);

  const stop = (next: MoveOutcome) => {
    setFinding(false);
    onMoving?.(false);
    setOutcome(next);
  };

  const move = async () => {
    // Another change saving (a date typed in, an Undo, a bases choice) is the learner's newer word.
    if (finding || isPending || changes.isSaving()) {
      return;
    }

    setOutcome(null);
    setFinding(true);
    onMoving?.(true);
    const started = changes.started();
    const found = await find();

    if (found.status !== "answered") {
      stop(found.status === "stale" ? null : found.status);
      return;
    }

    // A change that started while it searched (or the plan leaving the screen) comes after: the
    // date was for the plan before it, so it moves nothing.
    if (changes.started() !== started) {
      stop(null);
      return;
    }

    const { fittingDate } = found.time;

    if (!fittingDate) {
      stop("noDate");
      return;
    }

    setFinding(false);

    void change([{ kind: "setTargetDate", targetDate: fittingDate }], (saved) => {
      onMoving?.(false);

      if (saved?.status === "applied") {
        onMoved?.();
      }
    });

    // Move gives way once the plan covers everything: in the editor, the keyboard waits on the
    // time picked, not on the page behind it.
    keepFocus(() => findPickedChip(document.querySelector(`#${getEditorSectionId("time")}`)));
  };

  return { failed: failed || outcome === "failed", move, outcome, pending: finding || isPending };
}

/**
 * Why moving the date didn't work, where the plan's failed message would be. Inside a block that's
 * a live region already (the editor's time), it isn't an alert of its own (`live`), so it's said once.
 */
export function MoveDateFailure({
  live = true,
  move,
}: {
  live?: boolean;
  move: ReturnType<typeof useMoveDate>;
}) {
  const texts = useTimeToCoverTexts();

  if (move.failed) {
    return <PlanFailedMessage />;
  }

  if (move.outcome === "building" || move.outcome === "noDate") {
    return (
      <p className="text-destructive-text text-sm" role={live ? "alert" : undefined}>
        {move.outcome === "building" ? texts.building : texts.noDate}
      </p>
    );
  }

  return null;
}

/**
 * A control's label while its request runs (Find, Move your date, Get a recommendation, Study
 * everything): the kit's spinner before the unchanged label, so only its width is added.
 */
export function PendingLabel({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending: boolean;
}) {
  return (
    <>
      {pending && <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />}
      {children}
    </>
  );
}

/**
 * "Move your date to cover everything" as a button, in the plan editor (see `useMoveDate`), saving
 * through the schedule's one change at a time (`planChange`).
 */
export function MoveDateSwitch({
  id,
  onMoving,
  planChange,
}: {
  /** Where the editor finds it, to move focus to it once Find answers. */
  id?: string;
  onMoving?: (moving: boolean) => void;
  planChange?: ReturnType<typeof usePlanChange>;
}) {
  const t = useExtracted();
  const move = useMoveDate({ onMoving, planChange });

  return (
    <>
      <Button
        aria-busy={move.pending || undefined}
        className="self-start"
        disabled={move.pending}
        focusableWhenDisabled
        id={id}
        onClick={() => void move.move()}
        size="sm"
        variant="outline"
      >
        <PendingLabel pending={move.pending}>
          {t("Move your date to cover everything")}
        </PendingLabel>
      </Button>
      <MoveDateFailure live={false} move={move} />
    </>
  );
}

/** Where "Find the time that covers everything" stands (see `TimeToCoverState`). */
export type FindStatus = "answered" | "building" | "failed" | "idle" | "pending";

/**
 * "Find the time that covers everything" where it answers, in the plan editor's time a day and
 * onboarding's time step: the button while nothing's found (`canFind`), the answer in its place
 * once found, or why it couldn't be found, with Try again in the button's own element, so focus
 * stays on it. While it searches, only the button says so: its spinner, disabled, and a status for
 * screen readers. It's a polite live region of its own (`live`) unless it sits in one already, as
 * in the editor, so nothing is announced twice. It takes focus (found by `id`) when nothing closer
 * can once the button is gone. `waiting` takes its place while there's nothing to ask yet.
 */
export function FindTimeLine({
  answer,
  canFind,
  id,
  live = true,
  onFind,
  status,
  waiting,
}: {
  /** What the answer says, shown once found. */
  answer: React.ReactNode;
  canFind: boolean;
  id: string;
  live?: boolean;
  onFind: () => void;
  status: FindStatus;
  /** Why there's nothing to find yet (the plan is being built), in the line's place. */
  waiting?: React.ReactNode;
}) {
  const texts = useTimeToCoverTexts();
  const pending = status === "pending";
  const retry = status === "failed" || status === "building";

  return (
    <div
      aria-atomic={live ? false : undefined}
      aria-live={live ? "polite" : undefined}
      className="flex flex-col gap-2 empty:hidden focus-visible:outline-none"
      id={id}
      tabIndex={-1}
    >
      {waiting && <p>{waiting}</p>}

      {!waiting && status === "answered" && answer}

      {!waiting && retry && <p>{status === "building" ? texts.building : texts.failed}</p>}

      {!waiting && status !== "answered" && (canFind || retry) && (
        <Button
          aria-busy={pending || undefined}
          className="self-start"
          disabled={pending}
          focusableWhenDisabled
          key="find"
          onClick={onFind}
          size="sm"
          variant="outline"
        >
          <PendingLabel pending={pending}>{retry ? texts.tryAgain : texts.find}</PendingLabel>
        </Button>
      )}

      {pending && <span className="sr-only">{texts.finding}</span>}
    </div>
  );
}

/**
 * The picked chip of a list of time chips (`container`): where the keyboard waits when Find's answer
 * has nothing to take focus, since the answer itself is read by the block it's in.
 */
export function findPickedChip(container: ParentNode | null): HTMLElement | null {
  return container?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? null;
}

/**
 * The chip of a daily time in a list of time chips (`container`, its radios in the order of
 * `choices`), to take focus once Find marks it; null when it isn't there.
 */
export function findTimeChip({
  choices,
  container,
  minutes,
}: {
  choices: number[];
  container: HTMLElement | null;
  minutes: number;
}): HTMLElement | null {
  const index = choices.indexOf(minutes);

  return index === -1
    ? null
    : (container?.querySelectorAll<HTMLElement>('[role="radio"]')[index] ?? null);
}
