"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";

type SymbolicStep = { equation: string; move: string };
type WrongMove = { hint: string; move: string };

/** The next step's move among the written wrong moves, in a stable order that varies by step. */
function moveChoices(
  step: SymbolicStep,
  wrongMoves: readonly WrongMove[],
  index: number,
): string[] {
  const moves = [
    step.move,
    ...wrongMoves.map((wrong) => wrong.move).filter((move) => move !== step.move),
  ];

  const shift = index % moves.length;

  return [...moves.slice(shift), ...moves.slice(0, shift)];
}

/**
 * For equations bags and blocks can't show (negative numbers, fractions, big counts), the learner
 * picks each next move in symbols. A wrong move shows the writer's hint for it, and the equation
 * only changes on a right move, so the balance stays true.
 */
export function BalanceSymbolic({
  disabled,
  onSolved,
  start,
  steps,
  wrongMoves,
}: {
  disabled: boolean;
  onSolved: () => void;
  start: string;
  steps: readonly SymbolicStep[];
  wrongMoves: readonly WrongMove[];
}) {
  const t = useExtracted();
  const [reached, setReached] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const current = steps[reached - 1]?.equation ?? start;
  const next = steps[reached];

  function handlePick(move: string) {
    if (!next) {
      return;
    }

    if (move !== next.move) {
      setHint(wrongMoves.find((wrong) => wrong.move === move)?.hint ?? null);
      return;
    }

    setHint(null);
    setReached(reached + 1);

    if (reached + 1 === steps.length) {
      onSolved();
    }
  }

  return (
    <div className="flex flex-col gap-3" data-slot="balance-symbolic">
      <p aria-live="polite" className="text-center text-2xl font-bold tabular-nums">
        {current}
      </p>

      {next && !disabled && (
        <ActivitySelectGrid columns={1} label={t("Pick the next move")}>
          {moveChoices(next, wrongMoves, reached).map((move) => (
            <ActivitySelectGridItem isSelected={false} key={move} onToggle={() => handlePick(move)}>
              {move}
            </ActivitySelectGridItem>
          ))}
        </ActivitySelectGrid>
      )}

      {hint && (
        <p aria-live="polite" className="text-sm leading-snug">
          <span className="text-destructive font-semibold">{t("Not quite:")}</span> {hint}
        </p>
      )}
    </div>
  );
}
