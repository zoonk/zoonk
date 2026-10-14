"use client";

import { RotateCcwIcon, StepForwardIcon, TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { formatClock } from "../_utils/clock";
import { useMockScreen } from "./mock-context";

const TICK_MS = 1000;
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
  // When the question appeared, and the clock's latest tick.
  const [clock, setClock] = useState(() => ({ now: Date.now(), start: Date.now() }));
  const remaining = Math.max(0, clock.start + seconds * MS_PER_SECOND - clock.now);
  const done = useRef(false);

  const moveOn = useEffectEvent(() => runner.timeOutQuestion());

  useEffect(() => {
    const timer = setInterval(
      () => setClock((current) => ({ ...current, now: Date.now() })),
      TICK_MS,
    );

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !done.current) {
      done.current = true;
      moveOn();
    }
  }, [remaining]);

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
