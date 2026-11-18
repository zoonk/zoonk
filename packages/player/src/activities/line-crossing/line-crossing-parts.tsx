"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useSentenceSpace } from "@zoonk/learn/locale";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvasLabel, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { type LineOffsets, type ShiftAxis, lineShiftAnswer } from "./line-crossing-model";

type Fields = ActivityRendererProps<"lineCrossing">["content"]["fields"];
type FieldLine = Fields["lines"][number];
type Change = "down" | "same" | "up";

const Y_ARROWS = { down: ArrowDown, same: Minus, up: ArrowUp } as const;

export function useChangeWords() {
  const t = useExtracted();

  // An axis's label is a name, not a sentence's subject, so each change is its label and a value.
  return (axis: string) => ({
    down: t("{axis}: down", { axis }),
    same: t("{axis}: no change", { axis }),
    up: t("{axis}: up", { axis }),
  });
}

export function useLineWords() {
  const t = useExtracted();

  return {
    move: (line: FieldLine) => t("Move the line {line}", { line: line.label }),
    moved: (line: FieldLine, offset: number, axis: ShiftAxis) => {
      if (offset === 0) {
        return t("{line} hasn't moved.", { line: line.label });
      }

      if (axis === "horizontal") {
        return offset > 0
          ? t("{line} moved right.", { line: line.label })
          : t("{line} moved left.", { line: line.label });
      }

      return offset > 0
        ? t("{line} moved up.", { line: line.label })
        : t("{line} moved down.", { line: line.label });
    },
  };
}

function DragHint({ axis }: { axis: ShiftAxis }) {
  const t = useExtracted();

  const [drag, withKeys] =
    axis === "horizontal"
      ? [
          t("Drag a line left or right by its handle."),
          t("Drag a line left or right by its handle, or use the arrow keys."),
        ]
      : [
          t("Drag a line up or down by its handle."),
          t("Drag a line up or down by its handle, or use the arrow keys."),
        ];

  return (
    <ActivityCanvasLabel className="text-sm">
      <span className="lg:pointer-fine:hidden">{drag}</span>
      <span className="hidden lg:pointer-fine:inline">{withKeys}</span>
    </ActivityCanvasLabel>
  );
}

export function LineCrossingChanges({
  axis,
  fields,
  isChecked,
  moved,
  xChange,
  yChange,
}: {
  axis: ShiftAxis;
  fields: Fields;
  isChecked: boolean;
  moved: boolean;
  xChange: Change;
  yChange: Change;
}) {
  const changeWords = useChangeWords();
  const [YArrow, XArrow] = [Y_ARROWS[yChange], Y_ARROWS[xChange]];

  if (!moved && isChecked) {
    return null;
  }

  if (!moved) {
    return <DragHint axis={axis} />;
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

function wrongMoveFeedback(fields: Fields, offsets: LineOffsets, axis: ShiftAxis): string | null {
  const answer = lineShiftAnswer(offsets, axis);

  if (answer?.curve === fields.shift.line) {
    return answer.direction === fields.shift.direction ? null : fields.feedback.wrongDirection;
  }

  return fields.feedback.wrongLine;
}

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
  const space = useSentenceSpace();
  const shifted = fields.lines.find((line) => line.id === fields.shift.line);
  const feedback = isInteraction ? wrongMoveFeedback(fields, offsets, axis) : null;

  if (!shifted) {
    return null;
  }

  return (
    <p className="text-sm leading-relaxed">
      <span className="text-success-text font-medium">
        {lineWords.moved(shifted, realOffset, axis)}
      </span>
      {feedback && space}
      {feedback && <LessonRichText text={feedback} />}
    </p>
  );
}

export function LineCrossingDescription({
  computed,
  fields,
  moves,
}: {
  computed: number | null;
  fields: Fields;
  moves: string | null;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const [first, second] = fields.lines;
  const space = useSentenceSpace();

  return (
    <ActivityTextAlternative>
      {[
        t("A chart of two lines, {first} and {second}, with {y} against {x}.", {
          first: first?.label ?? "",
          second: second?.label ?? "",
          x: fields.xLabel,
          y: fields.yLabel,
        }),
        moves ?? t("Neither line has moved yet."),
        computed !== null && t("The new crossing is at {value}.", { value: format(computed) }),
      ]
        .filter(Boolean)
        .join(space)}
    </ActivityTextAlternative>
  );
}
