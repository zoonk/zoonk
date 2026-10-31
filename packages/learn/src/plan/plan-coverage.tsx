"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ChangeSaveError } from "../_components/save-error";
import { useTimeAnswerTexts } from "../_components/time-answer";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";
import { findSectionControl } from "./plan-editor-sections";
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

export function useCoveredText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const texts = useTimeAnswerTexts();
  const { plan } = usePlanScreen();
  const { dailyMinutes, targetDate, targetDateNamedMonth } = plan.schedule;

  return ({ coveredShare, measure }: Pick<Coverage, "coveredShare" | "measure">): string => {
    if (coveredShare < MIN_SHOWN_SHARE || !targetDate) {
      return t("{time} a day isn't enough time to cover your goal.", {
        time: formatDuration(dailyMinutes),
      });
    }

    return texts.share({
      date: { isoDate: targetDate, namedMonth: targetDateNamedMonth },
      exam: measure === "exam",
      value: coveredShare,
    });
  };
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
    keepFocus(() => findSectionControl("time"));
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
