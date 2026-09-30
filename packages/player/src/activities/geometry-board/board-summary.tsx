"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { ActivityCanvasLabel, ActivityReadout } from "../_components/activity-canvas";
import { useFormatNumber } from "../_utils/use-format-number";
import { type BoardMeasure } from "./board-geometry";
import { fanWedges } from "./board-marks";
import { type BoardReading } from "./board-measure";
import { BOARD_TONES, cornerTone, squareTone } from "./board-tones";

const FAN_RADIUS = 44;
const FAN_WIDTH = 180;
const FAN_PADDING = 6;
const TRIANGLE_CORNERS = 3;
const QUADRILATERAL_CORNERS = 4;
const PLUS = "+";
const EQUALS = "=";
const UNKNOWN = "?";

/**
 * The corners torn off and put side by side: a triangle's fill a straight line, a quadrilateral's
 * a full turn. It shows why the sum never changes, beyond the number.
 */
function AngleFan({ reading }: { reading: BoardReading }) {
  const t = useExtracted();
  const isTriangle = reading.parts.length === TRIANGLE_CORNERS;
  const center = { x: FAN_WIDTH / 2, y: FAN_RADIUS + FAN_PADDING };
  const height = isTriangle ? center.y + FAN_PADDING : center.y + FAN_RADIUS + FAN_PADDING;
  const wedges = fanWedges({ angles: reading.parts, center, radius: FAN_RADIUS });

  return (
    <div className="flex flex-col gap-1">
      <ActivityCanvasLabel>
        {t("Tear off the corners and put them side by side")}
      </ActivityCanvasLabel>

      <div className="flex items-end gap-3">
        <svg
          aria-hidden="true"
          className="shrink-0"
          height={height}
          viewBox={`0 0 ${FAN_WIDTH} ${height}`}
          width={FAN_WIDTH}
        >
          {wedges.map((path, index) => (
            <path
              className={BOARD_TONES[cornerTone(index, wedges.length)].mark}
              d={path}
              // oxlint-disable-next-line react/no-array-index-key -- Wedges follow the corners in order and never reorder.
              key={index}
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          ))}

          {isTriangle && (
            <path
              className="stroke-foreground"
              d={`M${FAN_PADDING} ${center.y} H${FAN_WIDTH - FAN_PADDING}`}
              strokeLinecap="round"
              strokeWidth={2}
            />
          )}
        </svg>

        <ActivityCanvasLabel className="pb-1 whitespace-nowrap">
          {isTriangle ? t("a straight line") : t("a full turn")}
        </ActivityCanvasLabel>
      </div>
    </div>
  );
}

function partTone({
  index,
  measure,
  reading,
}: {
  index: number;
  measure: BoardMeasure;
  reading: BoardReading;
}) {
  if (measure === "pythagoras") {
    return BOARD_TONES[
      squareTone({ index: reading.partIndexes[index] ?? index, totalIndex: reading.totalIndex })
    ];
  }

  return measure === "angleSum"
    ? BOARD_TONES[cornerTone(index, reading.parts.length)]
    : BOARD_TONES.neutral;
}

/**
 * What the board adds up, as one line under it: the parts in the colors they have on the board,
 * then the total. With a numeric check the total stays hidden until the answer is checked. The
 * canvas's text alternative says the same in words.
 */
export function BoardSummary({
  hideTotal,
  isAnswer,
  measure,
  reading,
}: {
  hideTotal: boolean;
  /** Once a numeric check is checked the total is its answer, marked as such. */
  isAnswer: boolean;
  measure: BoardMeasure;
  reading: BoardReading;
}) {
  const t = useExtracted();
  const format = useFormatNumber();
  const unit = measure === "angleSum" ? "°" : undefined;

  const showFan =
    measure === "angleSum" && !hideTotal && reading.parts.length <= QUADRILATERAL_CORNERS;

  const total = hideTotal ? (
    <span className="text-muted-foreground rounded-lg border border-dashed px-2">{UNKNOWN}</span>
  ) : (
    <span
      className={cn(
        measure === "pythagoras" && BOARD_TONES.highlight.ink,
        isAnswer && "text-success",
      )}
    >
      {format(reading.total, { unit })}
    </span>
  );

  return (
    <div className="flex flex-col gap-3">
      {showFan && <AngleFan reading={reading} />}

      {measure === "area" ? (
        <ActivityReadout aria-hidden="true" className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-base font-medium">{t("Area")}</span>
          {total}
        </ActivityReadout>
      ) : (
        <ActivityReadout aria-hidden="true" className="flex flex-wrap items-baseline gap-x-2">
          {reading.parts.map((part, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- Parts follow the corners or sides in order.
            <Fragment key={index}>
              {index > 0 && <span>{PLUS}</span>}
              <span className={partTone({ index, measure, reading }).ink}>
                {format(part, { unit })}
              </span>
            </Fragment>
          ))}
          <span>{EQUALS}</span>
          {total}
        </ActivityReadout>
      )}
    </div>
  );
}
