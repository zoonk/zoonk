"use client";

import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas } from "../_components/activity-canvas";
import { computeActivityValue } from "../_utils/compute-activity-value";
import { type ActivityRendererProps } from "../activity-renderer";
import { LineCrossingChart } from "./line-crossing-chart";
import {
  type LineOffsets,
  type ShiftAxis,
  changeDirection,
  crossingPoint,
  lineShiftAnswer,
  moveLine,
  movedLine,
  shiftAxis,
} from "./line-crossing-model";
import {
  LineCrossingAnswer,
  LineCrossingChanges,
  LineCrossingDescription,
  useChangeWords,
  useLineWords,
} from "./line-crossing-parts";

type LineCrossingProps = ActivityRendererProps<"lineCrossing">;
type Fields = LineCrossingProps["content"]["fields"];
type FieldLine = Fields["lines"][number];

const NOT_MOVED: LineOffsets = {};

/** The move that really happened, as a signed offset along the shift's axis. */
function realOffset(fields: Fields): number {
  const { amount, direction } = fields.shift;
  return direction === "right" || direction === "up" ? amount : -amount;
}

function sameOffsets(first: LineOffsets, second: LineOffsets): boolean {
  const ids = new Set([...Object.keys(first), ...Object.keys(second)]);
  return [...ids].every((id) => (first[id] ?? 0) === (second[id] ?? 0));
}

function crossingAfter(fields: Fields, offsets: LineOffsets, axis: ShiftAxis) {
  const [first, second] = fields.lines.map((line) => movedLine(line, offsets[line.id] ?? 0, axis));
  return first && second ? crossingPoint(first, second) : { x: 0, y: 0 };
}

/**
 * Two lines and where they cross: the learner drags one to explain a change (a supply shock, a
 * rent rise, a faster runner) and watches the crossing move, so which line moved and which way
 * feels different. The end state is the answer (which line, which way); a numeric check reads the
 * new crossing.
 */
export function LineCrossingActivity({
  content,
  labelId,
  onAnswerChange,
  phase,
}: LineCrossingProps) {
  const changeWords = useChangeWords();
  const lineWords = useLineWords();
  const { check, fields } = content;
  const [offsets, setOffsets] = useState<LineOffsets>(NOT_MOVED);
  const isChecked = phase === "checked";
  const axis = shiftAxis(fields.shift.direction);
  const [first, second] = fields.lines;

  if (!first || !second) {
    return null;
  }

  const before = crossingAfter(fields, NOT_MOVED, axis);
  const after = crossingAfter(fields, offsets, axis);
  const moved = !sameOffsets(offsets, NOT_MOVED);
  const yChange = changeDirection(before.y, after.y);
  const xChange = changeDirection(before.x, after.x);
  const real = moveLine(fields.shift.line, realOffset(fields));
  const readsX = check.kind === "numeric" && check.output === "x";
  const showsAnswer = isChecked && !sameOffsets(offsets, real);
  const shifted = fields.lines.find((line) => line.id === fields.shift.line);
  const changes = `${changeWords(fields.yLabel)[yChange]}. ${changeWords(fields.xLabel)[xChange]}.`;
  const movedText = (line: FieldLine) => lineWords.moved(line, offsets[line.id] ?? 0, axis);

  function handleMove(id: string, offset: number) {
    const next = moveLine(id, offset);
    setOffsets(next);

    if (check.kind === "interaction") {
      onAnswerChange(lineShiftAnswer(next, axis));
      return;
    }

    if (check.kind === "numeric") {
      const point = crossingAfter(fields, next, axis);
      onAnswerChange({ kind: "numeric", value: readsX ? point.x : point.y });
    }
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <p className="text-muted-foreground text-sm leading-relaxed">
        <LessonRichText text={fields.change} />
      </p>

      <LineCrossingChart
        amount={fields.shift.amount}
        answerLine={showsAnswer && shifted ? movedLine(shifted, real[shifted.id] ?? 0, axis) : null}
        axis={axis}
        handleText={(line) => ({
          label: lineWords.move(line),
          valueText: `${movedText(line)}. ${changes}`,
        })}
        isChecked={isChecked}
        lines={[first, second]}
        offsets={offsets}
        onMove={handleMove}
        xLabel={fields.xLabel}
        yLabel={fields.yLabel}
      />

      <LineCrossingChanges fields={fields} moved={moved} xChange={xChange} yChange={yChange} />

      {showsAnswer && (
        <LineCrossingAnswer
          axis={axis}
          fields={fields}
          isInteraction={check.kind === "interaction"}
          offsets={offsets}
          realOffset={realOffset(fields)}
        />
      )}

      <LineCrossingDescription
        changes={changes}
        computed={
          isChecked && check.kind === "numeric"
            ? computeActivityValue(content, { output: readsX ? "x" : "y" })
            : null
        }
        fields={fields}
        movedText={moved ? `${movedText(first)}. ${movedText(second)}.` : null}
      />
    </ActivityCanvas>
  );
}
