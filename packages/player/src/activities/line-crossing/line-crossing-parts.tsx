"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvasLabel, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { type LineOffsets, type ShiftAxis, lineShiftAnswer } from "./line-crossing-model";

type Fields = ActivityRendererProps<"lineCrossing">["content"]["fields"];
type FieldLine = Fields["lines"][number];
type Change = "down" | "same" | "up";

const Y_ARROWS = { down: ArrowDown, same: Minus, up: ArrowUp } as const;
const X_ARROWS = { down: ArrowLeft, same: Minus, up: ArrowRight } as const;

/** Words for how a move changed each axis, used on screen and by screen readers. */
export function useChangeWords() {
  const t = useExtracted();

  return (axis: string) => ({
    down: t("{axis} goes down", { axis }),
    same: t("{axis} stays the same", { axis }),
    up: t("{axis} goes up", { axis }),
  });
}

/** Words for a line's handle and for where the line is now. */
export function useLineWords() {
  const t = useExtracted();

  return {
    move: (line: FieldLine) => t("Move the line {line}", { line: line.label }),
    moved: (line: FieldLine, offset: number, axis: ShiftAxis) => {
      if (offset === 0) {
        return t("{line} hasn't moved", { line: line.label });
      }

      if (axis === "horizontal") {
        return offset > 0
          ? t("{line} moved right", { line: line.label })
          : t("{line} moved left", { line: line.label });
      }

      return offset > 0
        ? t("{line} moved up", { line: line.label })
        : t("{line} moved down", { line: line.label });
    },
  };
}

/** What the move did to each axis, with arrows, or how to move a line before anything moved. */
export function LineCrossingChanges({
  fields,
  moved,
  xChange,
  yChange,
}: {
  fields: Fields;
  moved: boolean;
  xChange: Change;
  yChange: Change;
}) {
  const t = useExtracted();
  const changeWords = useChangeWords();
  const [YArrow, XArrow] = [Y_ARROWS[yChange], X_ARROWS[xChange]];

  if (!moved) {
    return (
      <ActivityCanvasLabel className="text-sm">
        <span className="lg:pointer-fine:hidden">{t("Drag a line by its handle.")}</span>
        <span className="hidden lg:pointer-fine:inline">
          {t("Drag a line by its handle, or use the arrow keys.")}
        </span>
      </ActivityCanvasLabel>
    );
  }

  return (
    <div aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
      <span className="flex items-center gap-1.5">
        <YArrow className="size-4" />
        {changeWords(fields.yLabel)[yChange]}
      </span>
      <span className="flex items-center gap-1.5">
        <XArrow className="size-4" />
        {changeWords(fields.xLabel)[xChange]}
      </span>
    </div>
  );
}

/** The feedback for a wrong move: the other line moved, or this one moved the other way. */
function wrongMoveFeedback(fields: Fields, offsets: LineOffsets, axis: ShiftAxis): string | null {
  const answer = lineShiftAnswer(offsets, axis);

  if (answer?.curve === fields.shift.line) {
    return answer.direction === fields.shift.direction ? null : fields.feedback.wrongDirection;
  }

  return fields.feedback.wrongLine;
}

/** After the check, when the learner's move wasn't what happened: what did, and why theirs wasn't. */
export function LineCrossingAnswer({
  axis,
  fields,
  isInteraction,
  offsets,
  realOffset,
}: {
  axis: ShiftAxis;
  fields: Fields;
  isInteraction: boolean;
  offsets: LineOffsets;
  realOffset: number;
}) {
  const lineWords = useLineWords();
  const shifted = fields.lines.find((line) => line.id === fields.shift.line);
  const feedback = isInteraction ? wrongMoveFeedback(fields, offsets, axis) : null;

  if (!shifted) {
    return null;
  }

  return (
    <p className="text-sm leading-relaxed">
      <span className="text-success font-medium">
        {lineWords.moved(shifted, realOffset, axis)}.
      </span>{" "}
      {feedback && <LessonRichText text={feedback} />}
    </p>
  );
}

/** The chart in words: both lines, where each one is, what the move did and the new crossing. */
export function LineCrossingDescription({
  changes,
  computed,
  fields,
  movedText,
}: {
  changes: string;
  /** The new crossing a numeric check reads, once checked. */
  computed: number | null;
  fields: Fields;
  /** Where each line is now, or null when neither has moved. */
  movedText: string | null;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const [first, second] = fields.lines;

  return (
    <ActivityTextAlternative>
      {t("A chart of two lines, {first} and {second}, with {y} against {x}.", {
        first: first?.label ?? "",
        second: second?.label ?? "",
        x: fields.xLabel,
        y: fields.yLabel,
      })}{" "}
      {movedText ? `${movedText} ${changes}` : t("Neither line has moved yet.")}{" "}
      {computed !== null && t("The new crossing is at {value}.", { value: format(computed) })}
    </ActivityTextAlternative>
  );
}
