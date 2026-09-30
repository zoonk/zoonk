"use client";

import { useExtracted, useFormatter } from "next-intl";
import { type WeeklyRecapView } from "./logbook-context";

type Turnaround = NonNullable<WeeklyRecapView["turnaround"]>;

const WIDTH = 300;
const HEIGHT = 120;
const PAD = 14;

function toPoint({ accuracy, index, count }: { accuracy: number; count: number; index: number }) {
  const x = PAD + (index / Math.max(1, count - 1)) * (WIDTH - PAD * 2);
  const y = HEIGHT - PAD - accuracy * (HEIGHT - PAD * 2);

  return { x, y };
}

/**
 * A skill's right answers day by day through the week, days off left as gaps. It's decoration for
 * the sentence beside it, which says the same thing in words.
 */
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
    <figure
      className="border-border in-data-[mode=fun]:fun-glass flex flex-col gap-2 rounded-3xl border p-4"
      data-slot="turnaround-chart"
    >
      <svg
        aria-hidden="true"
        className="h-auto w-full overflow-visible"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <line
          className="stroke-border"
          x1={PAD}
          x2={WIDTH - PAD}
          y1={HEIGHT - PAD}
          y2={HEIGHT - PAD}
        />
        <path
          className="stroke-success"
          d={path}
          fill="none"
          strokeLinecap="round"
          strokeWidth="3"
        />
        {studied.map((point) => (
          <circle className="fill-success" cx={point.x} cy={point.y} key={point.index} r="4.5" />
        ))}
      </svg>

      <figcaption className="text-muted-foreground grid grid-cols-7 text-center text-xs">
        {turnaround.points.map((point) => (
          <span key={point.date.toISOString()}>
            {format.dateTime(point.date, { timeZone: "UTC", weekday: "narrow" })}
          </span>
        ))}
      </figcaption>
      <span className="sr-only">{t("Right answers on this skill each day of the week")}</span>
    </figure>
  );
}
