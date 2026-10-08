"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { SupplyDemandChart } from "./supply-demand-chart";
import {
  type Curve,
  type CurveOffsets,
  changeDirection,
  curveShiftAnswer,
  equilibrium,
  moveCurve,
  shiftLine,
  shiftedCurves,
} from "./supply-demand-model";

type SupplyDemandProps = ActivityRendererProps<"supplyDemand">;
type Fields = SupplyDemandProps["content"]["fields"];

const NOT_MOVED: CurveOffsets = { demand: 0, supply: 0 };

/** The move that really happened, as offsets the chart draws. */
function realOffsets(fields: Fields): CurveOffsets {
  const { amount, curve, direction } = fields.shift;
  return moveCurve(curve, direction === "right" ? amount : -amount);
}

function sameOffsets(first: CurveOffsets, second: CurveOffsets): boolean {
  return first.demand === second.demand && first.supply === second.supply;
}

/** Words for how a move changed price and quantity, used on screen and by screen readers. */
function useChangeWords() {
  const t = useExtracted();

  return {
    price: { down: t("Price goes down"), same: t("Price stays the same"), up: t("Price goes up") },
    quantity: {
      down: t("Quantity goes down"),
      same: t("Quantity stays the same"),
      up: t("Quantity goes up"),
    },
  };
}

function useCurveWords() {
  const t = useExtracted();

  return {
    move: (curve: Curve) =>
      curve === "supply" ? t("Move the supply curve") : t("Move the demand curve"),
    moved: (curve: Curve, offset: number) => {
      if (offset === 0) {
        return curve === "supply" ? t("Supply hasn't moved") : t("Demand hasn't moved");
      }

      if (curve === "supply") {
        return offset > 0 ? t("Supply moved right") : t("Supply moved left");
      }

      return offset > 0 ? t("Demand moved right") : t("Demand moved left");
    },
  };
}

const ARROWS = { down: ArrowDown, same: Minus, up: ArrowUp } as const;
const QUANTITY_ARROWS = { down: ArrowLeft, same: Minus, up: ArrowRight } as const;

/** The feedback for a wrong move: the other curve moved, or this one moved the other way. */
function wrongMoveFeedback(fields: Fields, offsets: CurveOffsets): string | null {
  const answer = curveShiftAnswer(offsets);

  if (answer?.curve === fields.shift.curve) {
    return answer.direction === fields.shift.direction ? null : fields.feedback.wrongDirection;
  }

  return fields.feedback.wrongCurve;
}

/**
 * Explain a real price change by moving a curve: the learner drags supply or demand and watches
 * the crossing move, so a supply shock and a demand shift feel different. The end state is the
 * answer (which curve, which way); a numeric check reads the new price or quantity.
 */
export function SupplyDemandActivity({
  content,
  labelId,
  onAnswerChange,
  phase,
}: SupplyDemandProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const changeWords = useChangeWords();
  const curveWords = useCurveWords();
  const { check, fields } = content;
  const [offsets, setOffsets] = useState<CurveOffsets>(NOT_MOVED);
  const isChecked = phase === "checked";
  const lines = shiftedCurves(fields, offsets);
  const before = equilibrium(fields.supply, fields.demand);
  const after = equilibrium(lines.supply, lines.demand);
  const moved = !sameOffsets(offsets, NOT_MOVED);
  const priceChange = changeDirection(before.price, after.price);
  const quantityChange = changeDirection(before.quantity, after.quantity);
  const real = realOffsets(fields);
  const PriceArrow = ARROWS[priceChange];
  const QuantityArrow = QUANTITY_ARROWS[quantityChange];
  const readsQuantity = check.kind === "numeric" && check.output === "quantity";

  function handleMove(curve: Curve, offset: number) {
    const next = moveCurve(curve, offset);
    setOffsets(next);

    if (check.kind === "interaction") {
      onAnswerChange(curveShiftAnswer(next));
      return;
    }

    if (check.kind === "numeric") {
      const point = equilibrium(
        shiftedCurves(fields, next).supply,
        shiftedCurves(fields, next).demand,
      );

      onAnswerChange({ kind: "numeric", value: readsQuantity ? point.quantity : point.price });
    }
  }

  const answerCurve = isChecked && !sameOffsets(offsets, real) ? fields.shift.curve : null;

  const feedback =
    isChecked && check.kind === "interaction" ? wrongMoveFeedback(fields, offsets) : null;

  const changes = `${changeWords.price[priceChange]}. ${changeWords.quantity[quantityChange]}.`;
  const computed = computeActivityValue(content, { output: readsQuantity ? "quantity" : "price" });

  return (
    <ActivityCanvas labelId={labelId}>
      <p className="text-muted-foreground text-sm leading-relaxed">
        <LessonRichText text={fields.event} />
      </p>

      <SupplyDemandChart
        answerLine={
          answerCurve
            ? { curve: answerCurve, line: shiftLine(fields[answerCurve], real[answerCurve]) }
            : null
        }
        fields={fields}
        handleText={(curve) => ({
          label: curveWords.move(curve),
          valueText: `${curveWords.moved(curve, offsets[curve])}. ${changes}`,
        })}
        isChecked={isChecked}
        offsets={offsets}
        onMove={handleMove}
      />

      {moved ? (
        <div aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <span className="flex items-center gap-1.5">
            <PriceArrow className="size-4" />
            {changeWords.price[priceChange]}
          </span>
          <span className="flex items-center gap-1.5">
            <QuantityArrow className="size-4" />
            {changeWords.quantity[quantityChange]}
          </span>
        </div>
      ) : (
        <ActivityCanvasLabel className="text-sm">
          <span className="lg:pointer-fine:hidden">{t("Drag a curve by its handle.")}</span>
          <span className="hidden lg:pointer-fine:inline">
            {t("Drag a curve by its handle, or use the arrow keys.")}
          </span>
        </ActivityCanvasLabel>
      )}

      {isChecked && answerCurve && (
        <p className="text-sm leading-relaxed">
          <span className="text-success font-medium">
            {curveWords.moved(fields.shift.curve, real[fields.shift.curve])}.
          </span>{" "}
          {feedback && <LessonRichText text={feedback} />}
        </p>
      )}

      <ActivityTextAlternative>
        {t("A supply and demand chart of {price} against {quantity}.", {
          price: fields.priceLabel,
          quantity: fields.quantityLabel,
        })}{" "}
        {moved
          ? `${curveWords.moved("supply", offsets.supply)}. ${curveWords.moved("demand", offsets.demand)}. ${changes}`
          : t("Neither curve has moved yet.")}{" "}
        {isChecked &&
          computed !== null &&
          check.kind === "numeric" &&
          t("The new crossing is at {value}.", { value: format(computed) })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
