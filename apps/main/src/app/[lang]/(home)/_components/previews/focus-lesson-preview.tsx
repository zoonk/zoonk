import { PhoneFrame } from "@/components/public/phone-frame";
import { EllipsisIcon, XIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { renderBold } from "../rich-text";
import { DepthChips } from "./depth-chips";
import { type LessonPrices } from "./lesson-prices";

/** The discount lesson in Focus: quiet, minimal, just the idea. */
export async function FocusLessonPreview({ prices }: { prices: LessonPrices }) {
  const t = await getExtracted();

  return (
    <PhoneFrame className="bg-background">
      <div className="flex items-center justify-between gap-1 border-b px-3 pb-2">
        <span className="flex size-9 flex-none items-center justify-center">
          <XIcon className="size-5" />
        </span>
        <p className="min-w-0 text-center text-[13px] leading-tight font-medium text-balance">
          {t("Percentages and discounts")}
        </p>
        <span className="flex size-9 flex-none items-center justify-center">
          <EllipsisIcon className="size-5" />
        </span>
      </div>

      <div className="bg-muted h-1">
        <div className="bg-primary h-full w-[30%]" />
      </div>

      {/* The old price and the discount share the first row and the new price sits under them,
      so nothing covers a label whatever its length. */}
      <div className="bg-muted/50 mx-5 mt-5 flex flex-col gap-3 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="bg-card -rotate-6 rounded-2xl px-4 py-3 text-center whitespace-nowrap shadow-[0_6px_20px_rgb(0_0_0/0.08)] dark:bg-neutral-800 dark:shadow-none">
            <p className="text-muted-foreground text-xs">{t("before")}</p>
            <p className="text-muted-foreground text-2xl font-bold tabular-nums line-through">
              {prices.before}
            </p>
          </div>
          <div className="flex size-16 flex-none items-center justify-center rounded-full bg-amber-400 text-base font-extrabold whitespace-nowrap text-amber-950 shadow-[0_8px_20px_rgb(245_158_11/0.35)]">
            {t("−25%")}
          </div>
        </div>
        <div className="bg-card rotate-[5deg] self-end rounded-2xl px-4 py-3 text-center whitespace-nowrap shadow-[0_6px_20px_rgb(0_0_0/0.1)] dark:bg-neutral-800 dark:shadow-none">
          <p className="text-muted-foreground text-xs">{t("you pay")}</p>
          <p className="text-3xl font-bold tabular-nums">{prices.after}</p>
        </div>
      </div>

      <div className="mt-6 px-6">
        <p className="text-muted-foreground text-lg font-semibold">
          {t("A discount is part of the price")}
        </p>
        <p className="mt-2 text-[17px] leading-relaxed">
          {t.rich(
            "A T-shirt costs <b>{before}</b> and is 25% off. You don't pay 25%. You pay the rest: <b>75%</b>.",
            { b: renderBold, before: prices.before },
          )}
        </p>
        <p className="mt-3 text-[17px] leading-relaxed">
          {t.rich("75% of 80 = 0.75 × 80 = <b>{after}</b>.", {
            after: prices.after,
            b: renderBold,
          })}
        </p>
      </div>

      <DepthChips className="mt-4 px-6" />
    </PhoneFrame>
  );
}
