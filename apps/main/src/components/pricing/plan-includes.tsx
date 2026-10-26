import { CheckMark } from "@/components/public/check-mark";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { LineMarker } from "@zoonk/ui/components/line-marker";

/**
 * What a plan includes: one big line that sums it up, then a few short lines, each with the quiet
 * check the public pages use for what's included.
 */
export function PlanIncludes({
  items,
  summary,
}: {
  items: { id: string; text: string }[];
  summary: string;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-lg leading-snug font-semibold tracking-[-0.02em] text-balance">
        {summary}
      </p>

      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li className="flex items-start gap-2.5 text-sm leading-5" key={item.id}>
            <LineMarker>
              <CheckMark size="sm" />
            </LineMarker>
            <span className="text-pretty">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A plan's price, a readout: its number large, its currency small and muted beside it, so a long
 * code ("ISK 2,299") never crowds the number, with what it's per after it.
 */
export function PlanPrice({ amount, per }: { amount: string; per?: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <BigQuantity className="text-[2.75rem]">{amount}</BigQuantity>
      {per && <span className="text-muted-foreground text-sm">{per}</span>}
    </p>
  );
}

/** A plan card's surface and its rows: name, price, action, then what it includes. */
export const PLAN_CARD_CLASS = "flex flex-col p-6 sm:p-7";

/** The name row, as tall as the billing switch beside Plus's, so both cards' rows line up. */
export const PLAN_NAME_ROW_CLASS = "flex min-h-11 flex-wrap items-center justify-between gap-3";

/** The price rows, as tall as Plus's price and its billing line. */
export const PLAN_PRICE_CLASS = "mt-4 flex min-h-[4.5rem] flex-col gap-2";
