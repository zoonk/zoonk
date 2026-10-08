"use client";

import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { renderBold } from "../rich-text";

type Ask = "simpler" | "deeper";

/** A buddy studied with today: awake and cheerful. */
const BUDDY_ENERGY = 70;

/**
 * A class topic on one screen, with the buddy beside it. The tile tells visitors to ask, so the
 * suggestions work: each one gets the buddy's answer, and tapping it again takes the answer away.
 */
export function ClassPreview() {
  const t = useExtracted();
  const [ask, setAsk] = useState<Ask | null>(null);

  const replies = {
    deeper: t.rich("It's the <b>slope</b> of the line that just touches the curve at that point.", {
      b: renderBold,
    }),
    simpler: t.rich("Think of a speedometer: it shows <b>how fast</b> you're going right now.", {
      b: renderBold,
    }),
  };

  const toggle = (next: Ask) => setAsk((current) => (current === next ? null : next));

  return (
    <div className={cn(PREVIEW_CARD_CLASS, "mt-5 p-4 sm:mt-6")}>
      <p className="text-[15px] leading-snug">
        {t.rich("A derivative is <b>how fast</b> something changes at one moment.", {
          b: renderBold,
        })}
      </p>

      <svg aria-hidden="true" className="mt-2 w-full" fill="none" viewBox="0 0 270 96">
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

      <div className="mt-3 flex items-start gap-2.5">
        <Buddy beltColor="yellow" className="size-8" crop="face" energy={BUDDY_ENERGY} kind="zu" />
        <p
          aria-live="polite"
          className="bg-muted dark:bg-background/60 rounded-2xl rounded-tl-md px-3 py-2 text-[14px] leading-snug"
        >
          {ask ? replies[ask] : t("Stuck, or curious for more? Just ask.")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          aria-pressed={ask === "simpler"}
          onClick={() => toggle("simpler")}
          size="sm"
          variant={ask === "simpler" ? "default" : "outline"}
        >
          {t("Explain it more simply")}
        </Button>
        <Button
          aria-pressed={ask === "deeper"}
          onClick={() => toggle("deeper")}
          size="sm"
          variant={ask === "deeper" ? "default" : "outline"}
        >
          {t("I want to go deeper")}
        </Button>
      </div>
    </div>
  );
}
