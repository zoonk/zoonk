"use client";

import { TrophyIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/** Fun's weekly Big Challenge, the week's mix or its mock, announced as an event. */
export function BigChallengeCard({
  children,
  eyebrow,
  reward,
  subtitle,
}: {
  /** Its numbers, between the title and the reward. */
  children?: React.ReactNode;
  eyebrow: string;
  reward: string;
  subtitle: string;
}) {
  const t = useExtracted();

  return (
    <section className="fun-glass fun-holo-border flex flex-col gap-4 rounded-3xl p-5">
      {/* The trophy rides on the date's line so the title has the card's full width: some
          languages name it in one long word ("Große Herausforderung"). */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-fun-accent-lime text-xs font-semibold tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
          <TrophyIcon aria-hidden="true" className="text-fun-accent-amber size-6 shrink-0" />
        </div>
        <h1 className="font-fun-display text-2xl font-bold wrap-break-word hyphens-auto sm:text-3xl">
          {t("Big Challenge")}
        </h1>
        <p className="text-fun-fg2 text-sm">{subtitle}</p>
      </div>

      {children}

      <p className="border-fun-line border-t border-dashed pt-3 text-sm">{reward}</p>
    </section>
  );
}
