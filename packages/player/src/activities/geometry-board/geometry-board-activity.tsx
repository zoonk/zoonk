"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { Button } from "@zoonk/ui/components/button";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { Lightbulb, RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { BoardDrawing } from "./board-drawing";
import {
  type BoardPoint,
  boardBounds,
  gridStep,
  hasMoved,
  minimumArea,
  moveCorner,
} from "./board-geometry";
import { readBoard } from "./board-measure";
import { createBoardScale } from "./board-scale";
import { BoardSummary } from "./board-summary";
import { useDescribeBoard } from "./use-describe-board";

type GeometryBoardProps = ActivityRendererProps<"geometryBoard">;
type Vector = { x: number; y: number };

/** Phone width of the canvas, used until the real width is measured. */
const FALLBACK_WIDTH = 318;
const MAX_HEIGHT = 340;
const PADDING = 20;
const FIRST_LETTER = 65;

/**
 * Drag the corners of a shape and watch what always stays true: the angles' sum, a² + b² = c² on
 * a right triangle, or an area. Code measures every position and rounds so the parts on screen
 * add up to the total on screen. With a numeric check the total stays hidden until checked: the
 * learner works it out from the parts, which is only asked when it never changes.
 */
export function GeometryBoardActivity({ content, labelId, phase }: GeometryBoardProps) {
  const t = useExtracted();
  const describe = useDescribeBoard();
  const format = useFormatNumber();
  const descriptionId = useId();
  const { check, fields } = content;
  const start = fields.points;
  const [points, setPoints] = useState<BoardPoint[]>(start);
  const { ref, width } = useMeasuredWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const isChecked = phase === "checked";
  const hideTotal = check.kind === "numeric" && !isChecked;
  const step = gridStep(start);
  const bounds = boardBounds({ measure: fields.measure, points: start, step });
  const scale = createBoardScale({ bounds, maxHeight: MAX_HEIGHT, padding: PADDING, width });
  const reading = readBoard(points, fields.measure);
  const summary = describe({ hideTotal, measure: fields.measure, reading });

  function handleMoveTo(index: number, to: Vector) {
    const next = moveCorner({
      bounds,
      index,
      measure: fields.measure,
      minArea: minimumArea(start),
      points,
      step,
      to,
    });

    if (next) {
      setPoints(next);
    }
  }

  function handleMoveBy(index: number, offset: Vector) {
    const corner = points[index];

    if (corner) {
      handleMoveTo(index, { x: corner.x + offset.x, y: corner.y + offset.y });
    }
  }

  function cornerName(index: number): string {
    return points[index]?.label ?? String.fromCodePoint(FIRST_LETTER + index);
  }

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="-mx-2" ref={ref}>
        <BoardDrawing
          bounds={bounds}
          cornerLabel={(index) => t("Corner {name}", { name: cornerName(index) })}
          cornerValueText={(point) =>
            t("At {x}, {y}. {summary}", { summary, x: format(point.x), y: format(point.y) })
          }
          descriptionId={descriptionId}
          disabled={isChecked}
          hideTotal={hideTotal}
          measure={fields.measure}
          onMoveBy={handleMoveBy}
          onMoveTo={handleMoveTo}
          points={points}
          reading={reading}
          scale={scale}
          start={start}
          step={step}
          width={width}
        />
      </div>

      <p className="sr-only" id={descriptionId}>
        {t("Drag it, or use the arrow keys to move it one grid step.")}
      </p>

      <BoardSummary
        hideTotal={hideTotal}
        isAnswer={check.kind === "numeric" && isChecked}
        measure={fields.measure}
        reading={reading}
      />

      {!isChecked && hasMoved(points, start) && (
        <Button
          className="min-h-11 w-fit"
          onClick={() => setPoints(start)}
          size="lg"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" />
          {t("Back to the start")}
        </Button>
      )}

      {isChecked && (
        <p className="flex items-start gap-2 text-sm leading-snug">
          <Lightbulb aria-hidden="true" className="text-viz-highlight mt-0.5 size-4 shrink-0" />
          <LessonRichText text={fields.invariant} />
        </p>
      )}

      <ActivityTextAlternative>
        {t(
          "A shape with {count} corners on a grid. {movable, plural, one {# corner moves} other {# corners move}}.",
          { count: format(points.length), movable: points.filter((point) => point.movable).length },
        )}{" "}
        {summary}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
