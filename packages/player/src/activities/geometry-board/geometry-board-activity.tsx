"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { useSentenceSpace } from "@zoonk/learn/locale";
import { Button } from "@zoonk/ui/components/button";
import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { RotateCcw } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivityTip } from "../_components/activity-tip";
import { hidesAskedTotal } from "../_utils/hides-asked-total";
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

const MAX_HEIGHT = 340;
const PADDING = 20;
const FIRST_LETTER = 65;

export function GeometryBoardActivity({ content, labelId, phase }: GeometryBoardProps) {
  const t = useExtracted();
  const describe = useDescribeBoard();
  const space = useSentenceSpace();
  const format = useFormatNumber();
  const descriptionId = useId();
  const { check, fields } = content;
  const start = fields.points;
  const [points, setPoints] = useState<BoardPoint[]>(start);
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();
  const isChecked = phase === "checked";
  const hideTotal = hidesAskedTotal({ check, phase });
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
      <div ref={ref}>
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

      {isChecked && <ActivityTip text={fields.invariant} />}

      <ActivityTextAlternative>
        {t(
          "A shape with {count} corners on a grid. {movable, plural, one {# corner moves} other {# corners move}}.",
          { count: format(points.length), movable: points.filter((point) => point.movable).length },
        )}
        {space}
        {summary}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
