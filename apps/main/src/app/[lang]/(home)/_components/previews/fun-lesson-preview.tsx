import { PhoneFrame } from "@/components/public/phone-frame";
import { Buddy } from "@zoonk/ui/components/buddy";
import { XIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { renderBold } from "../rich-text";
import { DepthChips } from "./depth-chips";
import { type LessonPrices } from "./lesson-prices";

const DONE_DOTS = 2;
const LATER_DOTS = 4;
const BUDDY_ENERGY = 85;

function ProgressDots() {
  const later = Array.from({ length: LATER_DOTS }, (_, index) => index);
  const done = Array.from({ length: DONE_DOTS }, (_, index) => index);

  return (
    <div className="flex items-center justify-center gap-[7px]">
      {done.map((index) => (
        <span
          className="bg-fun-lime size-2 rounded-full shadow-[0_0_8px_rgb(200_255_77/0.9)]"
          key={`done-${index}`}
        />
      ))}
      <span className="border-fun-fg size-3 rounded-full border-2" />
      {later.map((index) => (
        <span className="bg-fun-track size-2 rounded-full" key={`later-${index}`} />
      ))}
    </div>
  );
}

function renderStrike(chunks: ReactNode) {
  return <s className="decoration-fun-accent-pink decoration-2">{chunks}</s>;
}

/**
 * The price card on the lesson's panel. The sticker hangs off its top-right corner, where the
 * first line leaves room for it, so it never covers a price.
 */
async function PriceCard({ prices }: { prices: LessonPrices }) {
  const t = await getExtracted();

  return (
    <div className="bg-fun-soft rounded-[22px] p-3.5">
      <div className="bg-background relative rounded-xl px-3.5 py-3 shadow-[0_10px_14px_rgb(60_40_160/0.16)]">
        <p className="text-fun-fg2 pr-12 text-[13px] leading-snug font-semibold">
          {t.rich("was <old>{before}</old>, now", { before: prices.before, old: renderStrike })}
        </p>
        <p className="font-fun-display mt-1 text-[28px] leading-none font-bold whitespace-nowrap">
          {prices.after}
        </p>
        <p className="text-fun-accent-violet mt-1.5 text-xs font-semibold">{t("you pay 75%")}</p>
        <div className="bg-fun-gold absolute -top-3 -right-3 rotate-12 rounded-lg px-2.5 py-3 text-center whitespace-nowrap text-amber-950 shadow-[0_8px_12px_rgb(160_110_0/0.22)]">
          <p className="font-fun-display text-[13px] leading-none font-bold">{t("−25%")}</p>
          <p className="mt-1.5 text-xs font-semibold">{prices.discount}</p>
        </div>
      </div>
    </div>
  );
}

/** The same discount lesson in Fun: the buddy cheering, a combo of right answers and the paper panel. */
export async function FunLessonPreview({ prices }: { prices: LessonPrices }) {
  const t = await getExtracted();

  return (
    <PhoneFrame className="fun-space">
      <div className="grid grid-cols-[72px_1fr_72px] items-center px-4">
        <span className="fun-glass flex size-10 items-center justify-center rounded-full">
          <XIcon className="size-5" />
        </span>
        <ProgressDots />
        <span className="fun-glass ml-auto flex h-8 items-center rounded-full px-2.5 text-[13px] font-bold">
          <span className="fun-holo-text">{t("x3")}</span>
        </span>
      </div>

      <div className="relative mx-3 mt-[70px]">
        <Buddy
          beltColor="yellow"
          className="absolute top-[-62px] left-3 z-10 size-16"
          energy={BUDDY_ENERGY}
          expression="cheer"
          kind="zu"
        />
        <p className="fun-glass absolute top-[-54px] left-[84px] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm font-medium">
          {t("Look how clever this is:")}
        </p>

        <div className="fun-paper rounded-[30px] px-4 py-5 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)]">
          <PriceCard prices={prices} />

          <p className="text-fun-fg2 mt-4 text-[15px] font-semibold">
            {t("A discount is part of the price")}
          </p>
          <p className="mt-1.5 text-base leading-normal">
            {t.rich(
              "A T-shirt costs <b>{before}</b> and is 25% off. You don't pay 25%. You pay the rest: <b>75%</b>.",
              { b: renderBold, before: prices.before },
            )}
          </p>

          <div className="bg-fun-soft mt-3 flex min-h-[50px] flex-wrap items-center justify-between gap-x-3 rounded-2xl px-4 py-2 whitespace-nowrap">
            <span className="font-fun-display text-[15px] font-semibold">{t("0.75 × 80")}</span>
            <span className="font-fun-display text-lg font-bold">
              {t("= {after}", { after: prices.after })}
            </span>
          </div>

          <DepthChips className="mt-4" variant="fun" />
        </div>
      </div>
    </PhoneFrame>
  );
}
