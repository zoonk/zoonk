"use client";

import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { RotateCcwIcon, StepForwardIcon, TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { formatClock } from "../_utils/clock";
import { useTimeLeft } from "../_utils/use-time-left";
import { useMockScreen } from "./mock-context";

const MS_PER_SECOND = 1000;

/**
 * How the section moves, in a quiet line, as the notice sets it: never back to a question once
 * left, an answer before moving on, and in the review at a forward-only section's end, the answers
 * it may still change. Nothing for a section that moves freely.
 */
export function MovesNote() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { changesLeft, forwardOnly, mustAnswer, reviewing } = runner.moves;

  const line = (() => {
    if (reviewing) {
      return changesLeft === null
        ? t("Review: you can go back to any question.")
        : t(
            "{count, plural, =0 {Review: no more answers can change.} one {Review: you can change # more answer.} other {Review: you can change # more answers.}}",
            { count: changesLeft },
          );
    }

    if (forwardOnly && mustAnswer) {
      return t("Answer each question to move on. You can't go back to it.");
    }

    if (forwardOnly) {
      return t("You can't go back to a question once you move on.");
    }

    return mustAnswer ? t("Answer each question to move on.") : null;
  })();

  if (!line) {
    return null;
  }

  const Icon = reviewing ? RotateCcwIcon : StepForwardIcon;

  return (
    <p className="text-balance">
      <Icon aria-hidden="true" className="mr-1.5 inline size-3.5 align-[-0.1875rem]" />
      {line}
    </p>
  );
}

/**
 * A question's own clock, inline in the line under the header: when it runs out, the next
 * question opens, or after the last one the answers close until the learner hands the section in.
 */
function ItemCountdown({ seconds }: { seconds: number }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const deadline = useMountTime().getTime() + seconds * MS_PER_SECOND;
  const remaining = useTimeLeft({ deadline, onTimeUp: runner.timeOutQuestion });

  return (
    <span className="text-foreground flex items-center gap-1 font-mono font-medium tabular-nums">
      <TimerIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span aria-label={t("Time left for this question")} role="timer">
        {formatClock(remaining)}
      </span>
    </span>
  );
}

/** Each question's clock, where the notice gives every question its own time. */
export function ItemClock() {
  const { runner } = useMockScreen();
  const seconds = runner.moves.itemSeconds;
  const itemId = runner.view.current?.questions[runner.position]?.itemId;

  // A new clock for every question, started when it appears.
  return seconds && itemId ? <ItemCountdown key={itemId} seconds={seconds} /> : null;
}
