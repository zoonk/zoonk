"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { useFormatNumber } from "../_utils/use-format-number";
import { type ActivityRendererProps } from "../activity-renderer";
import { BalanceControls } from "./balance-controls";
import {
  type BalanceMove,
  type BalanceState,
  applyMove,
  canDrawBlocks,
  isolatedValue,
  panText,
  parseBalance,
  reachedSteps,
  solveBalance,
  splitGroups,
  tiltDegrees,
} from "./balance-model";
import { BalanceScale } from "./balance-scale";
import { BalanceSteps } from "./balance-steps";
import { BalanceSymbolic } from "./balance-symbolic";

type BalanceProps = ActivityRendererProps<"balance">;
type Fields = BalanceProps["content"]["fields"];

function balanceObjects(fields: Fields) {
  const unknown = fields.objects.find((object) => object.symbol === fields.variable) ?? {
    label: fields.variable,
    symbol: fields.variable,
  };

  const unit = fields.objects.find((object) => object.symbol !== fields.variable) ?? {
    label: "1",
    symbol: "1",
  };

  return { unit, unknown };
}

function useEquationText(symbol: string) {
  const format = useFormatNumber();

  return (state: BalanceState) => ({
    left: panText(state.left, symbol, (value) => format(value)),
    right: panText(state.right, symbol, (value) => format(value)),
  });
}

function BlockBalance({
  fields,
  isChecked,
  onAnswerChange,
  solution,
  start,
}: {
  fields: Fields;
  isChecked: boolean;
  onAnswerChange: BalanceProps["onAnswerChange"];
  solution: number;
  start: BalanceState;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const objects = balanceObjects(fields);
  const toText = useEquationText(objects.unknown.symbol);
  const [history, setHistory] = useState<BalanceState[]>([]);
  const [current, setCurrent] = useState(start);
  const [wrongMoves, setWrongMoves] = useState(0);
  const tilt = tiltDegrees(current, solution);
  const sides = toText(current);

  const steps = fields.steps.map((step) => ({
    move: step.move,
    state: parseBalance(step, fields.variable),
  }));

  const reached = reachedSteps({
    current,
    history,
    solution,
    steps: steps.map((step) => step.state),
  });

  function update(next: BalanceState, previous: BalanceState[]) {
    setCurrent(next);
    setHistory(previous);
    const value = isolatedValue(next);
    onAnswerChange(value === null ? null : { kind: "numeric", value });
  }

  function handleMove(move: BalanceMove) {
    const next = applyMove(current, move);

    if (tiltDegrees(next, solution) !== 0 && tilt === 0) {
      setWrongMoves(wrongMoves + 1);
    }

    update(next, [...history, current]);
  }

  const hint = fields.hints[(wrongMoves - 1 + fields.hints.length) % fields.hints.length]?.hint;
  const relation = tilt === 0 ? "=" : "≠";

  return (
    <>
      <BalanceScale
        formatUnits={(value) => format(value)}
        frame={start}
        heavierLabel={t("Heavier")}
        state={current}
        symbol={objects.unknown.symbol}
        tilt={tilt}
      />

      <p
        aria-hidden="true"
        className="flex items-center justify-center gap-3 text-2xl font-bold tabular-nums"
      >
        <span>{sides.left}</span>
        <span className={cn(tilt !== 0 && "text-destructive")}>{relation}</span>
        <span>{sides.right}</span>
      </p>

      {tilt !== 0 && hint && (
        <p aria-live="polite" className="text-sm leading-snug">
          <span className="text-destructive font-semibold">{t("Not quite:")}</span> {hint}
        </p>
      )}

      {!isChecked && (
        <BalanceControls
          canUndo={history.length > 0}
          objects={objects}
          onMove={handleMove}
          onUndo={() => update(history.at(-1) ?? start, history.slice(0, -1))}
          splitGroups={tilt === 0 ? splitGroups(current) : null}
          state={current}
        />
      )}

      <BalanceSteps
        reached={reached}
        showAll={isChecked}
        steps={fields.steps.map((step, index) => {
          const text = steps[index]?.state
            ? toText(steps[index].state)
            : { left: step.left, right: step.right };

          return { equation: `${text.left} = ${text.right}`, move: step.move };
        })}
      />

      <ActivityTextAlternative>
        {t("A balance. Left pan: {left}. Right pan: {right}.", sides)}{" "}
        {tilt === 0 ? t("The pans are level.") : null}
        {tilt > 0 ? t("The right pan is heavier.") : null}
        {tilt < 0 ? t("The left pan is heavier.") : null}
      </ActivityTextAlternative>
    </>
  );
}

/**
 * An equation as a balance: the learner takes the same thing off both pans and watches it stay
 * level, until one unknown stands alone and its weight is the answer. Taking from one side only
 * tips the beam and shows the writer's hint. Equations bags and blocks can't draw are solved one
 * move at a time in symbols instead.
 */
export function BalanceActivity({ content, labelId, onAnswerChange, phase }: BalanceProps) {
  const { fields } = content;
  const start = parseBalance(fields.equation, fields.variable);
  const solution = start ? solveBalance(start) : null;
  const isChecked = phase === "checked";
  const toText = useEquationText(fields.variable);

  if (start && solution !== null && canDrawBlocks(start, solution)) {
    return (
      <ActivityCanvas labelId={labelId}>
        <BlockBalance
          fields={fields}
          isChecked={isChecked}
          onAnswerChange={onAnswerChange}
          solution={solution}
          start={start}
        />
      </ActivityCanvas>
    );
  }

  const steps = fields.steps.map((step) => {
    const state = parseBalance(step, fields.variable);
    const text = state ? toText(state) : step;
    return { equation: `${text.left} = ${text.right}`, move: step.move, state };
  });

  const last = steps.at(-1)?.state;
  const answer = last ? isolatedValue(last) : null;
  const startText = start ? toText(start) : fields.equation;

  return (
    <ActivityCanvas labelId={labelId}>
      <BalanceSymbolic
        disabled={isChecked}
        onSolved={() => onAnswerChange(answer === null ? null : { kind: "numeric", value: answer })}
        start={`${startText.left} = ${startText.right}`}
        steps={steps}
        wrongMoves={fields.hints}
      />

      {isChecked && <BalanceSteps reached={steps.length} showAll steps={steps} />}
    </ActivityCanvas>
  );
}
