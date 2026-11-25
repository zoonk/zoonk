import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { type CSSProperties } from "react";

/* In a module of their own so server components (the public pages) can draw the bands too. */

export const BAND_STATE_CLASS: Record<PlanPhaseView["state"], string> = {
  current: "bg-surface-3 text-foreground isolate",
  done: "bg-success/13 text-success-text",
  leftOut: "bg-muted text-muted-foreground",
  unfinished: "bg-muted text-muted-foreground",
  upcoming: "bg-muted text-muted-foreground",
};

/** One cell: the name and anything that only sizes the band (`BAND_SIZER_CLASS`) share it. */
export const BAND_CLASS =
  "relative grid min-h-7.5 min-w-min items-center rounded-md px-2.5 py-1 text-left text-xs font-medium";

const BAND_CELL_CLASS = "col-start-1 row-start-1";

const BAND_NAME_CLASS = cn(
  BAND_CELL_CLASS,
  "leading-4 text-balance in-data-[fit=letters]:wrap-anywhere in-data-[fit=letters]:hyphens-auto",
);

/**
 * How the band names break, tried in this order until every band fits the row: each name's parts
 * kept whole (`splitBandName`), then between any words, then inside words.
 */
const BAND_FITS = ["parts", "words", "letters"] as const;

export type BandFit = (typeof BAND_FITS)[number];

/** The first way the names fit (`overflows` lays the row out with it), or the last when none does. */
export function chooseBandFit(overflows: (fit: BandFit) => boolean): BandFit {
  return BAND_FITS.find((fit) => !overflows(fit)) ?? "letters";
}

const ONE_LINE_NAME_LENGTH = 16;

const SHORT_WORD_LENGTH = 3;

const LETTER = /\p{L}/gu;

function countLetters(word: string): number {
  return word.match(LETTER)?.length ?? 0;
}

/**
 * A short name is one part; a longer one is cut between words. A cut is worse for each thing that
 * reads badly: a short word at the end of the first line ("Médico e") and one word alone on the
 * second. The cut with the fewest wins; among those, the one whose longer part is shortest.
 */
export function splitBandName(name: string): [string, string | null] {
  const words = name.split(" ");

  if (name.length <= ONE_LINE_NAME_LENGTH || words.length === 1) {
    return [name, null];
  }

  const cuts = words.slice(1).map((_word, index) => {
    const first = words.slice(0, index + 1).join(" ");
    const second = words.slice(index + 1);
    const endsShort = countLetters(words[index] ?? "") <= SHORT_WORD_LENGTH;

    return {
      faults: Number(endsShort) + Number(second.length === 1),
      first,
      longest: Math.max(first.length, second.join(" ").length),
      second: second.join(" "),
    };
  });

  const best = cuts.reduce((chosen, cut) =>
    cut.faults < chosen.faults || (cut.faults === chosen.faults && cut.longest < chosen.longest)
      ? cut
      : chosen,
  );

  return [best.first, best.second];
}

const BAND_NAME_PART_CLASS =
  "inline-block whitespace-nowrap in-data-[fit=letters]:inline in-data-[fit=letters]:whitespace-normal in-data-[fit=words]:inline in-data-[fit=words]:whitespace-normal";

/**
 * A phase's name in parts that never break inside, so a short phase's band grows to its name: a
 * short name keeps one line and a longer one takes two at most. When the row can't fit every
 * band's widest part, the row's `data-fit` lets the names break elsewhere (`BandFit`). `leading`
 * stays with the first word.
 */
export function BandName({ leading, name }: { leading?: React.ReactNode; name: string }) {
  const [first, second] = splitBandName(name);

  return (
    <span className={BAND_NAME_CLASS} data-slot="band-name">
      <span className={BAND_NAME_PART_CLASS}>
        {leading}
        {first}
      </span>
      {second && (
        <>
          {" "}
          <span className={BAND_NAME_PART_CLASS}>{second}</span>
        </>
      )}
    </span>
  );
}

/** Invisible text in the band's cell: the band is never narrower than it until the names break inside words. */
export const BAND_SIZER_CLASS = cn(
  BAND_CELL_CLASS,
  "invisible h-0 whitespace-nowrap in-data-[fit=letters]:hidden",
);

/** Inline in the name, so a narrow band's lines get its whole width. */
export const BAND_CHECK_CLASS = "mr-1 inline size-3.5 align-[-0.1875rem]";

/**
 * The columns share their rows, so every band is as tall as the one whose name takes the most
 * lines, and one phase's labels taking two lines leaves the bands alike.
 */
export const BAND_ROWS_CLASS = "grid gap-x-2";

/**
 * The floor is on the column, not the band: a grid sizes a column by the band's minimum width
 * when it has one, so a long word in the name would no longer widen it.
 */
export const BAND_COLUMN_CLASS = "relative row-span-full grid min-w-18 grid-rows-subgrid";

/**
 * A band is drawn to its time but never narrower than its name's longest word, so the column
 * can't be a size container (that would give it no width of its own): the axis under it is.
 */
export function getBandColumnsStyle(weights: readonly number[]): CSSProperties {
  return {
    gridTemplateColumns: weights.map((weight) => `minmax(min-content, ${weight}fr)`).join(" "),
  };
}

export const AXIS_CLASS = "@container/phase relative flex min-h-4 flex-wrap content-start gap-x-2";

/** A date carries its own data face (`PlanDateText`); a word on the axis, such as "Today", keeps the text face. */
export const AXIS_TEXT_CLASS =
  "text-faint min-w-0 max-w-full text-2xs leading-4 wrap-anywhere text-balance";

const MIDDLE_SHARE = 0.5;

const PERCENT = 100;

export function getPointSide(share: number): "left" | "right" {
  return share < MIDDLE_SHARE ? "left" : "right";
}

function getAxisLabelBox({ after, share }: { after: boolean; share: number }): {
  className: string;
  style: CSSProperties;
} {
  if (after) {
    return {
      className: "ml-auto flex min-w-0 max-w-full text-right",
      style: { paddingRight: `${(1 - share) * PERCENT}%` },
    };
  }

  if (getPointSide(share) === "left") {
    return {
      className: "flex min-w-0 max-w-full justify-end",
      style: { paddingLeft: `${share * PERCENT}%` },
    };
  }

  return {
    className: "flex min-w-0 max-w-full justify-end text-right",
    style: { width: `${share * PERCENT}%` },
  };
}

/** Labels keep their gap and can wrap within the phase. */
export function AxisLabel({
  after = false,
  children,
  className,
  share,
}: {
  after?: boolean;
  children: React.ReactNode;
  className?: string;
  share: number;
}) {
  const box = getAxisLabelBox({ after, share });

  return (
    <span className={cn(box.className, className)} style={box.style}>
      {children}
    </span>
  );
}
