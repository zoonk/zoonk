"use client";

import { Button } from "@zoonk/ui/components/button";
import { CalendarCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useChangeSaveFailed } from "../_components/save-error";
import { TIME_ANSWER_BUTTON_CLASS } from "../_components/time-answer";
import { useFormatIsoDate } from "../_utils/iso-date";
import { usePlanScreen, useSubjectsTakenOut } from "./plan-context";
import { findSectionControl } from "./plan-editor-sections";
import { usePlanChange } from "./use-plan-change";
import { useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/** The plan's date is too close to study everything at the learner's time. */
export function useFallsShort(): boolean {
  const { plan } = usePlanScreen();
  const { feasibility } = plan;
  return Boolean(feasibility?.deadline && !feasibility.fits);
}

export function useCanMoveDate(): boolean {
  const { goal, plan } = usePlanScreen();
  const fallsShort = useFallsShort();
  return goal.kind !== "exam" && fallsShort && !plan.feasibility?.timeCovers;
}

type MoveOutcome = "building" | "failed" | "noDate" | null;

/**
 * Until the date is known, a tap finds it and the control names it; once named, one tap moves it.
 * Saved as any change (S1).
 */
function useMoveDate({
  onMoved,
  onMoving,
  planChange,
}: {
  onMoved?: () => void;
  onMoving?: (moving: boolean) => void;
  planChange?: ReturnType<typeof usePlanChange>;
} = {}) {
  const own = usePlanChange();
  const { change, isPending } = planChange ?? own;
  const { changes, keepFocus } = usePlanScreen();
  const { answered, find } = useTimeToCover();
  const [finding, setFinding] = useState(false);
  const [outcome, setOutcome] = useState<MoveOutcome>(null);
  const saveFailed = useChangeSaveFailed();
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

    if (found.status === "failed") {
      saveFailed();
    }
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

  return { date, move, outcome, pending: finding || isPending };
}

export function useMoveDateToCoverLabel(): string {
  const t = useExtracted();

  return useSubjectsTakenOut()
    ? t("Move your date to cover everything in your plan")
    : t("Move your date to cover everything");
}

function MoveDateLabel({ move }: { move: ReturnType<typeof useMoveDate> }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const coverLabel = useMoveDateToCoverLabel();

  return move.date
    ? t("Move your date to {date}", { date: formatDate(move.date, "sentence") })
    : coverLabel;
}

/** `live={false}` inside a block that's a live region already, so it's said once. */
function MoveDateFailure({
  live = true,
  move,
}: {
  live?: boolean;
  move: ReturnType<typeof useMoveDate>;
}) {
  const texts = useTimeToCoverTexts();

  if (move.outcome === "building" || move.outcome === "noDate") {
    return (
      <p className="text-destructive-text text-sm" role={live ? "alert" : undefined}>
        {move.outcome === "building" ? texts.building : texts.noDate}
      </p>
    );
  }

  return null;
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
        busy={move.pending}
        className={TIME_ANSWER_BUTTON_CLASS}
        icon={<CalendarCheckIcon aria-hidden="true" />}
        id={id}
        onClick={() => void move.move()}
        size="sm"
        variant="outline"
      >
        <MoveDateLabel move={move} />
      </Button>
      <MoveDateFailure live={false} move={move} />
    </>
  );
}
