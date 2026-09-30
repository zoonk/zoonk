import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { renderBold } from "../rich-text";
import { DepthChips } from "./depth-chips";

/** A class topic on one screen, with the depth controls every screen has. */
export async function ClassPreview() {
  const t = await getExtracted();

  return (
    <div aria-hidden="true" className={cn(PREVIEW_CARD_CLASS, "mt-5 p-4 sm:mt-6")}>
      <p className="text-[15px] leading-snug">
        {t.rich("A derivative is <b>how fast</b> something changes at one moment.", {
          b: renderBold,
        })}
      </p>

      <svg className="mt-2 w-full" fill="none" viewBox="0 0 270 96">
        <path className="stroke-border" d="M10 90 H262" strokeWidth="1.5" />
        <path
          className="stroke-foreground"
          d="M10 88 Q170 88 260 10"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <path
          className="stroke-amber-600"
          d="M116 84 L236 36.4"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <circle
          className="stroke-card fill-amber-600 dark:stroke-neutral-800"
          cx="176.8"
          cy="59.9"
          r="5.5"
          strokeWidth="2.5"
        />
        <text
          className="fill-amber-700 text-xs font-semibold dark:fill-amber-400"
          textAnchor="end"
          x="262"
          y="80"
        >
          {t("right now")}
        </text>
      </svg>

      <DepthChips className="mt-2" />
    </div>
  );
}
