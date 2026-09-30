"use client";

import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { type ReactNode, useId, useState } from "react";

const COST_PER_CAKE = 17;
const CAKES_PER_WEEK = 12;
const START_PRICE = 28;
const MIN_PRICE = 18;
const MAX_PRICE = 40;

function renderAmount(chunks: ReactNode) {
  return <b className="text-foreground tabular-nums">{chunks}</b>;
}

/**
 * Numbers to play with: drag the price and see what's left per cake and per
 * week. It's the one live preview on the page, because moving the number is
 * the point.
 */
export function BusinessPreview({ currency }: { currency: string }) {
  const t = useExtracted();
  const format = useFormatter();
  const priceId = useId();
  const [price, setPrice] = useState(START_PRICE);

  const money = (value: number) =>
    format.number(value, { currency, maximumFractionDigits: 0, style: "currency" });

  const profit = price - COST_PER_CAKE;

  return (
    <div className={cn(PREVIEW_CARD_CLASS, "mt-5 p-4 sm:mt-6")}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium" htmlFor={priceId}>
          {t("Price per cake")}
        </label>
        <output className="text-[22px] font-bold tracking-tight tabular-nums" htmlFor={priceId}>
          {money(price)}
        </output>
      </div>

      <input
        aria-valuetext={money(price)}
        className="mt-3 h-11 w-full cursor-pointer accent-rose-500"
        id={priceId}
        max={MAX_PRICE}
        min={MIN_PRICE}
        onChange={(event) => setPrice(Number(event.target.value))}
        type="range"
        value={price}
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="bg-muted/60 rounded-xl px-3 py-2.5 dark:bg-neutral-800">
          <p className="text-muted-foreground text-xs">{t("Cost")}</p>
          <p className="text-base font-semibold tabular-nums">{money(COST_PER_CAKE)}</p>
        </div>
        <div className="bg-muted/60 rounded-xl px-3 py-2.5 dark:bg-neutral-800">
          <p className="text-muted-foreground text-xs">{t("You keep")}</p>
          <p className="text-base font-semibold tabular-nums">
            {t("{amount} a cake", { amount: money(profit) })}
          </p>
        </div>
      </div>

      <p aria-live="polite" className="text-muted-foreground mt-3 text-[13px]">
        {t.rich("{cakes} cakes a week: <b>{amount}</b> for you", {
          amount: money(profit * CAKES_PER_WEEK),
          b: renderAmount,
          cakes: String(CAKES_PER_WEEK),
        })}
      </p>
    </div>
  );
}
