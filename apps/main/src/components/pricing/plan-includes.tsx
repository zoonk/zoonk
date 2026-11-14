import { CheckItem } from "@/components/public/check-mark";
import { BigQuantity } from "@zoonk/ui/components/big-quantity";

export function PlanIncludes({
  items,
  summary,
}: {
  items: { id: string; text: string }[];
  summary: string;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-base leading-snug font-semibold tracking-[-0.015em] text-balance">
        {summary}
      </p>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <CheckItem className="text-sm leading-5" key={item.id}>
            {item.text}
          </CheckItem>
        ))}
      </ul>
    </div>
  );
}

export function PlanPrice({ amount, per }: { amount: string; per?: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <BigQuantity className="text-[2.5rem]">{amount}</BigQuantity>
      {per && <span className="text-muted-foreground text-compact">{per}</span>}
    </p>
  );
}

export const PLAN_CARD_CLASS = "flex flex-col p-6 sm:p-7";

/**
 * Side by side, a card's four parts (name, price, next step, what it includes) sit on the rows of
 * the grid around the cards, so each part starts on one line in both.
 */
export const PLAN_CARD_ROWS_CLASS = "@3xl:row-span-4 @3xl:grid @3xl:grid-rows-subgrid @3xl:gap-y-0";

export const PLAN_NAME_ROW_CLASS = "flex flex-wrap items-center justify-between gap-3";

export const PLAN_PRICE_CLASS = "mt-4 flex flex-col gap-2";
