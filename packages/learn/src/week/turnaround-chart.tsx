"use client";

import { useExtracted, useFormatter } from "next-intl";
import { type WeeklyRecapView } from "./logbook-context";

type Turnaround = NonNullable<WeeklyRecapView["turnaround"]>;

const WIDTH = 300;
const HEIGHT = 120;
const PAD = 14;

/** A point sits over the middle of its day's letter in the caption's grid. */
const DAY_CENTER = 0.5;

function toPoint({ accuracy, index, count }: { accuracy: number; count: number; index: number }) {
  const x = ((index + DAY_CENTER) / count) * WIDTH;
  const y = HEIGHT - PAD - accuracy * (HEIGHT - PAD * 2);

  return { x, y };
}

export function TurnaroundChart({ turnaround }: { turnaround: Turnaround }) {
  const t = useExtracted();
  const format = useFormatter();
  const count = turnaround.points.length;

  const studied = turnaround.points.flatMap((point, index) =>
    point.accuracy === null
      ? []
      : [{ ...toPoint({ accuracy: point.accuracy, count, index }), index }],
  );

  const path = studied
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <figure className="flex w-full flex-col gap-2" data-slot="turnaround-chart">
      <svg
        aria-hidden="true"
        className="h-auto w-full overflow-visible"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <line className="stroke-viz-grid" x1={0} x2={WIDTH} y1={HEIGHT - PAD} y2={HEIGHT - PAD} />
        <path
          className="stroke-success"
          d={path}
          fill="none"
          strokeLinecap="round"
          strokeWidth="2"
        />
        {studied.map((point) => (
          <circle className="fill-success" cx={point.x} cy={point.y} key={point.index} r="3.5" />
        ))}
      </svg>

      <figcaption className="text-muted-foreground text-2xs grid grid-cols-7 text-center font-mono">
        {turnaround.points.map((point) => (
          <span key={point.date.toISOString()}>
            {format.dateTime(point.date, { timeZone: "UTC", weekday: "narrow" })}
          </span>
        ))}
      </figcaption>
      <span className="sr-only">{t("Right answers on this topic each day of the week")}</span>
    </figure>
  );
}
