/**
 * An illustration of the forgetting curve: memory decays toward a floor after each study, and each
 * review comes when it has dipped to the same point, so the gaps between reviews grow.
 */
const FLOOR = 0.12;
const DIP = 0.45;

const FIRST_REVIEW = 1;
const SECOND_REVIEW = 4;
const THIRD_REVIEW = 11;
export const TODAY_DAY = 19;
export const LAST_DAY = 34;

export const REVIEW_DAYS = [FIRST_REVIEW, SECOND_REVIEW, THIRD_REVIEW, TODAY_DAY, LAST_DAY];

/** Where unreviewed memory has flattened out, so the rest of its line is straight. */
const UNREVIEWED_UNTIL = 16;

const VIEWBOX = 1000;
const STEP = 0.5;
const SHORT_STEP = 0.125;
const X_MARGIN = 0.02;
const Y_MARGIN = 0.06;
const PLOT = 0.96;
const HEIGHT = 0.88;

export function dayShare(day: number): number {
  return X_MARGIN + (day / LAST_DAY) * PLOT;
}

function memory({ day, since, span }: { day: number; since: number; span: number }): number {
  return FLOOR + (1 - FLOOR) * Math.exp(-(day - since) / span);
}

function point({ day, value }: { day: number; value: number }): string {
  const x = Math.round(dayShare(day) * VIEWBOX);
  const y = Math.round((Y_MARGIN + (1 - value) * HEIGHT) * VIEWBOX);
  return `${x} ${y}`;
}

function decay({ from, span, to }: { from: number; span: number; to: number }): string[] {
  const step = to - from <= 1 ? SHORT_STEP : STEP;
  const count = Math.round((to - from) / step);

  return Array.from({ length: count + 1 }, (_, index) => {
    const day = from + index * step;
    return point({ day, value: memory({ day, since: from, span }) });
  });
}

function path(points: string[]): string {
  return `M${points.join("L")}`;
}

function reviewed({ from, until }: { from: number; until: number }): string {
  const days = [0, ...REVIEW_DAYS].filter((day) => day >= from && day <= until);

  return path(
    days.slice(0, -1).flatMap((start, index) => {
      const end = days[index + 1] ?? start;
      return decay({ from: start, span: (end - start) / DIP, to: end });
    }),
  );
}

export function getForgettingCurve() {
  const unreviewedSpan = 1 / DIP;

  return {
    next: reviewed({ from: TODAY_DAY, until: LAST_DAY }),
    reviewed: `${reviewed({ from: 0, until: TODAY_DAY })}L${point({ day: TODAY_DAY, value: 1 })}`,
    unreviewed: path([
      ...decay({ from: 0, span: unreviewedSpan, to: UNREVIEWED_UNTIL }),
      point({ day: LAST_DAY, value: memory({ day: LAST_DAY, since: 0, span: unreviewedSpan }) }),
    ]),
  };
}
