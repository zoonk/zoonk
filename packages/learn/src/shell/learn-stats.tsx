"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { BrainIcon, ZapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";

const PILL_CLASS =
  "bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring/50 in-data-[mode=fun]:fun-glass in-data-[mode=fun]:text-fun-fg hit-area relative flex h-11 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold whitespace-nowrap tabular-nums outline-none focus-visible:ring-[3px] sm:px-3 lg:h-10";

/** Where each number leads: the stats pages that explain it. */
type LearnStatsHrefs = { brainPower: string; energy: string };

/** The learner's numbers for the top bar. Null for someone who hasn't learned anything yet. */
export type LearnStatsView = {
  belt: { color: BeltColor; level: number };
  brainPower: number;
  energy: number;
} | null;

function EnergyPill({ energy, href }: { energy: number; href: string }) {
  const t = useExtracted();
  const format = useFormatter();
  const percent = format.number(energy / 100, { maximumFractionDigits: 0, style: "percent" });

  return (
    <LearnLink className={PILL_CLASS} href={href}>
      <ZapIcon
        aria-hidden="true"
        className="text-energy in-data-[mode=fun]:text-fun-energy size-4"
      />
      <span className="sr-only">{t("Energy")}</span>
      {percent}
    </LearnLink>
  );
}

/**
 * Energy on the right of the top bar. Focus shows only Energy; Fun also names the level on the
 * belt and the Brain Power total, which it celebrates. The numbers are the same in both modes.
 * Fun adds them where the bar has room, so the goal switcher keeps a readable title: phones leave
 * both to the buddy's tab, and on laptops the level waits for extra-wide screens so the dock
 * between the goal and the numbers stays centered.
 */
export function LearnStats({ hrefs, stats }: { hrefs: LearnStatsHrefs; stats: LearnStatsView }) {
  const t = useExtracted();
  const format = useFormatter();
  const mode = useExperienceMode();

  if (!stats) {
    return null;
  }

  if (mode === "focus") {
    return <EnergyPill energy={stats.energy} href={hrefs.energy} />;
  }

  return (
    <div className="flex items-center gap-1 sm:gap-1.5">
      <LearnLink
        className={cn(PILL_CLASS, "hidden sm:flex lg:hidden xl:flex")}
        href={hrefs.brainPower}
      >
        {/* A white belt on light glass needs a stronger edge to stay visible (3:1 for graphics). */}
        <BeltIndicator
          className="ring-fun-fg/60"
          color={stats.belt.color}
          label={t("Belt")}
          size="sm"
        />
        {t("Level {level}", { level: String(stats.belt.level) })}
      </LearnLink>

      <EnergyPill energy={stats.energy} href={hrefs.energy} />

      <LearnLink className={cn(PILL_CLASS, "hidden sm:flex")} href={hrefs.brainPower}>
        <BrainIcon aria-hidden="true" className="text-fun-accent-pink size-4" />
        <span className="sr-only">{t("Brain Power")}</span>
        {format.number(stats.brainPower)}
      </LearnLink>
    </div>
  );
}
