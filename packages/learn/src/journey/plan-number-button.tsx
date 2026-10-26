"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { BigQuantity } from "../_components/big-quantity";
import { Meter, MeterFill } from "../_components/meter";
import { PAGE_SECTION_TITLE_CLASS } from "../_components/page";

/**
 * A number as the Plan shows it: what it is, its value and one line under it. A share or a level
 * (`numeric`) is a readout, its unit small; a value in words ("On pace", "Ended", "Not yet") stays
 * a word. A share (`share`, 0 to 1) draws its meter under it, filled in progress's blue.
 */
export type PlanNumber = {
  detail: React.ReactNode;
  label: string;
  numeric?: boolean;
  share?: number;
  value: React.ReactNode;
};

/**
 * How a number looks: a hairline tile (in the page's column) or a plain block (in the aside). A
 * button is as wide as its words unless told otherwise, so each fills its half of the row.
 */
const NUMBER_CLASS = {
  stats:
    "-m-2 w-[calc(100%+1rem)] rounded-lg p-2 hover:bg-muted/70 focus-visible:ring-ring/50 flex min-w-0 flex-col gap-1.5 text-left outline-none transition-colors focus-visible:ring-[3px]",
  tiles:
    "ring-border rounded-option hover:bg-muted/50 focus-visible:ring-ring/50 flex h-full w-full min-w-0 flex-col gap-1.5 p-3 text-left ring-1 outline-none transition-colors ring-inset focus-visible:ring-[3px]",
} as const;

/** Where the Plan draws its numbers: tiles in the page's column, plain blocks in the aside. */
export type PlanNumberVariant = keyof typeof NUMBER_CLASS;

/**
 * A number's name: inside a tile, the tile's quiet label (as a `StatTile`'s); in the aside, a
 * real title in sentence case, as every block of the aside is named.
 */
const NUMBER_LABEL_CLASS = {
  stats: cn(PAGE_SECTION_TITLE_CLASS, "truncate"),
  tiles: "text-label truncate",
} as const;

/** One number as a button opening its details in a sheet. */
export function NumberButton({
  number,
  onOpen,
  variant,
}: {
  number: PlanNumber;
  onOpen: () => void;
  variant: PlanNumberVariant;
}) {
  return (
    <button aria-haspopup="dialog" className={NUMBER_CLASS[variant]} onClick={onOpen} type="button">
      <span className={NUMBER_LABEL_CLASS[variant]}>{number.label}</span>{" "}
      {/* The spaces keep "Pace On pace" phrases apart for screen readers; the column hides them. */}
      <span
        className={cn(
          "text-2xl leading-tight",
          number.numeric ? "text-readout" : "font-semibold tracking-[-0.03em]",
        )}
      >
        {number.numeric && typeof number.value === "string" ? (
          <BigQuantity>{number.value}</BigQuantity>
        ) : (
          number.value
        )}
      </span>
      {number.share !== undefined && (
        <Meter className="my-0.5">
          <MeterFill className="bg-success" share={number.share} />
        </Meter>
      )}
      {number.detail && (
        <>
          {" "}
          <span className="text-muted-foreground text-xs leading-snug">{number.detail}</span>
        </>
      )}
    </button>
  );
}
