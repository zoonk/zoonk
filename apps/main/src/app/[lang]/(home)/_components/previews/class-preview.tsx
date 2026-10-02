"use client";

import { PREVIEW_CARD_CLASS } from "@/components/public/landing-styles";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { FeatherIcon, LayersIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { renderBold } from "../rich-text";

type Depth = "original" | "simpler" | "deeper";

/**
 * A class topic on one screen, with the depth buttons every lesson screen has. The tile tells
 * visitors to tap them, so they work: each swaps the explanation, and tapping it again brings the
 * original back.
 */
export function ClassPreview() {
  const t = useExtracted();
  const [depth, setDepth] = useState<Depth>("original");

  const explanation = {
    deeper: t.rich("It's the <b>slope</b> of the line that just touches the curve at that point.", {
      b: renderBold,
    }),
    original: t.rich("A derivative is <b>how fast</b> something changes at one moment.", {
      b: renderBold,
    }),
    simpler: t.rich("Think of a speedometer: it shows <b>how fast</b> you're going right now.", {
      b: renderBold,
    }),
  }[depth];

  const toggle = (next: Depth) => setDepth((current) => (current === next ? "original" : next));

  return (
    <div className={cn(PREVIEW_CARD_CLASS, "mt-5 p-4 sm:mt-6")}>
      <p aria-live="polite" className="text-[15px] leading-snug">
        {explanation}
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

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          aria-pressed={depth === "simpler"}
          onClick={() => toggle("simpler")}
          size="sm"
          variant={depth === "simpler" ? "default" : "secondary"}
        >
          <FeatherIcon aria-hidden="true" />
          {t("Simpler")}
        </Button>
        <Button
          aria-pressed={depth === "deeper"}
          onClick={() => toggle("deeper")}
          size="sm"
          variant={depth === "deeper" ? "default" : "secondary"}
        >
          <LayersIcon aria-hidden="true" />
          {t("Go deeper")}
        </Button>
      </div>
    </div>
  );
}
