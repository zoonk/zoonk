"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { getEditorSectionId } from "./plan-editor-sections";
import { usePlanChange } from "./use-plan-change";
import { useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/** Below half a percent, the share would read "0%". */
const MIN_SHOWN_SHARE = 0.005;

/** Null when the plan covers everything in depth or has no date to cover it by. */
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

export function useTimeEnough(): boolean {
  const { plan } = usePlanScreen();
  return plan.feasibility?.timeCovers ?? false;
}

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

type CoveredProps = Pick<Coverage, "coreFits" | "coveredShare" | "deepensMostAsked" | "measure">;

export function useCoveredText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const time = formatDuration(plan.schedule.dailyMinutes);
  const { fullCourse } = plan.schedule;

  return ({ coreFits, coveredShare, deepensMostAsked, measure }: CoveredProps): string => {
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

export function useCanMoveDate(): boolean {
  const { goal } = usePlanScreen();
  const coverage = usePlanCoverage();
  const timeEnough = useTimeEnough();
  return goal.kind !== "exam" && coverage !== null && !timeEnough;
}

type MoveOutcome = "building" | "failed" | "noDate" | null;

/**
 * Until the date is known, a tap finds it and the control names it; once named, one tap moves it.
 * Saved as any change (S1).
 */
export function useMoveDate({
  onMoved,
  onMoving,
  planChange,
}: {
  onMoved?: () => void;
  onMoving?: (moving: boolean) => void;
  planChange?: ReturnType<typeof usePlanChange>;
} = {}) {
  const own = usePlanChange();
  const { change, failed, isPending } = planChange ?? own;
  const { changes, keepFocus } = usePlanScreen();
  const { answered, find } = useTimeToCover();
  const [finding, setFinding] = useState(false);
  const [outcome, setOutcome] = useState<MoveOutcome>(null);
  const date = answered?.fittingDate ?? null;

  const findDate = async () => {
    setFinding(true);
    onMoving?.(true);
    const found = await find();
    setFinding(false);
    onMoving?.(false);

    if (found.status === "answered") {
      setOutcome(found.time.fittingDate ? null : "noDate");
      return;
    }

    setOutcome(found.status === "stale" ? null : found.status);
  };

  const move = async () => {
    // Another change saving (a date typed in, an Undo, a bases choice) is the learner's newer word.
    if (finding || isPending || changes.isSaving()) {
      return;
    }

    setOutcome(null);

    if (!date) {
      await findDate();
      return;
    }

    onMoving?.(true);

    void change([{ kind: "setTargetDate", targetDate: date }], (saved) => {
      onMoving?.(false);

      if (saved?.status === "applied") {
        onMoved?.();
      }
    });

    // Move gives way once the plan covers everything, so the keyboard waits on the time picked.
    keepFocus(() => findPickedChip(document.querySelector(`#${getEditorSectionId("time")}`)));
  };

  return {
    date,
    failed: failed || outcome === "failed",
    move,
    outcome,
    pending: finding || isPending,
  };
}

export function MoveDateLabel({ move }: { move: ReturnType<typeof useMoveDate> }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return move.date
    ? t("Move your date to {date}", { date: formatDate(move.date, "long") })
    : t("Move your date to cover everything");
}

/** `live={false}` inside a block that's a live region already, so it's said once. */
export function MoveDateFailure({
  live = true,
  move,
}: {
  live?: boolean;
  move: ReturnType<typeof useMoveDate>;
}) {
  const texts = useTimeToCoverTexts();

  if (move.failed) {
    return <ChangeSaveError />;
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

export function MoveDateSwitch({
  id,
  onMoving,
  planChange,
}: {
  id?: string;
  onMoving?: (moving: boolean) => void;
  planChange?: ReturnType<typeof usePlanChange>;
}) {
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
          <MoveDateLabel move={move} />
        </PendingLabel>
      </Button>
      <MoveDateFailure live={false} move={move} />
    </>
  );
}

export type FindStatus = "answered" | "building" | "failed" | "idle" | "pending";

/**
 * A polite live region of its own (`live`) unless it sits in one already; Try again takes the
 * button's own element, so focus stays on it.
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
  answer: React.ReactNode;
  canFind: boolean;
  id: string;
  live?: boolean;
  onFind: () => void;
  status: FindStatus;
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

export function findPickedChip(container: ParentNode | null): HTMLElement | null {
  return container?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? null;
}

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
