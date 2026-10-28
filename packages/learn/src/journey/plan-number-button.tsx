"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { BigQuantity } from "../_components/big-quantity";
import { Meter, MeterFill } from "../_components/meter";
import { PAGE_SECTION_TITLE_CLASS } from "../_components/page";

/** `share` is 0 to 1. */
export type PlanNumber = {
  detail: React.ReactNode;
  label: string;
  numeric?: boolean;
  share?: number;
  value: React.ReactNode;
};

const NUMBER_CLASS = {
  stats:
    "-m-2 w-[calc(100%+1rem)] rounded-lg p-2 hover:bg-muted/70 focus-visible:ring-ring/50 flex min-w-0 flex-col gap-1.5 text-left outline-none transition-colors focus-visible:ring-[3px]",
  tiles:
    "ring-border rounded-option hover:bg-muted/50 focus-visible:ring-ring/50 flex h-full w-full min-w-0 flex-col gap-1.5 p-3 text-left ring-1 outline-none transition-colors ring-inset focus-visible:ring-[3px]",
} as const;

export type PlanNumberVariant = keyof typeof NUMBER_CLASS;

const NUMBER_LABEL_CLASS = {
  stats: cn(PAGE_SECTION_TITLE_CLASS, "truncate"),
  tiles: "text-label truncate",
} as const;

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
