"use client";

import { BRAIN_POWER_BONUS } from "@zoonk/core/sessions/brain-power";
import { BeltIndicator, beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, ChevronsUpIcon, UtensilsIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StepCard, StepRow, StepRows, StepTitle } from "../../_components/step-card";
import { useBeltName } from "../../_utils/use-belt-name";
import { useBuddyName } from "../../buddies/use-buddy-name";
import { type StudySessionSummary } from "../session-types";
import { useSessionSummary } from "./summary-context";

/** A belt has ten levels, each a stripe. */
const STRIPES_PER_BELT = 10;

/** A streak worth naming: three right answers in a row or more. */
const SHOWN_STREAK = 3;

type SummaryBelt = NonNullable<StudySessionSummary["belt"]>;

/** A level's tick in its belt's color; a white belt's would vanish on the panel, so it's ink. */
function tickClass(color: SummaryBelt["after"]["color"]): string {
  return color === "white" ? "bg-foreground/70" : beltColorClasses[color];
}

/** Whether the session earned anything worth its own step: only what happened is said. */
export function hasRewards(summary: StudySessionSummary): boolean {
  return (
    summary.brainPower > 0 ||
    summary.fullMeal ||
    (summary.belt?.stripesGained ?? 0) > 0 ||
    summary.bestStreak >= SHOWN_STREAK
  );
}

/** The buddy, glad about the day; a Brain Power tile before one is picked. */
function RewardsArt() {
  const t = useExtracted();
  const { buddy } = useSessionSummary();
  const name = useBuddyName(buddy ?? { kind: "zu", name: null });

  if (!buddy) {
    return (
      <span className="motion-safe:animate-badge-land bg-muted text-foreground flex size-16 items-center justify-center rounded-2xl">
        <BrainIcon aria-hidden="true" className="size-8" />
      </span>
    );
  }

  return (
    <Buddy
      beltColor={buddy.beltColor}
      className="motion-safe:animate-badge-land size-28 sm:size-32"
      energy={buddy.energy}
      expression="cheer"
      glasses={buddy.glasses}
      kind={buddy.kind}
      label={t("{buddy}, happy with today", { buddy: name })}
      studiedToday
    />
  );
}

/** The full meal: all three missions done, and the bonus they paid. */
function FullMealRow() {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <StepRow>
      <UtensilsIcon aria-hidden="true" className="text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{t("Full meal")}</span>
        <span className="text-muted-foreground">{t("All three missions done today")}</span>
      </span>
      <span className="text-success shrink-0 font-semibold tabular-nums">
        {t("+{bonus}", { bonus: format.number(BRAIN_POWER_BONUS.fullMeal) })}
      </span>
    </StepRow>
  );
}

/**
 * A stripe earned today: the belt's ten levels as ticks, lit in its color, with the belt and level
 * named and "+1 stripe" beside it. A new belt color starts over.
 */
function BeltRow({ belt }: { belt: SummaryBelt }) {
  const t = useExtracted();
  const beltName = useBeltName();
  const { color, level } = belt.after;

  return (
    <StepRow className="flex-col items-stretch gap-2" data-slot="belt-stripes">
      <span className="flex items-center gap-3">
        <BeltIndicator color={color} label={beltName(color)} />
        <span className="min-w-0 flex-1 font-medium">
          {t("{belt}, level {level}", { belt: beltName(color), level: String(level) })}
        </span>
        <span className="text-success shrink-0 font-semibold">
          {t("{count, plural, one {+# level} other {+# levels}}", { count: belt.stripesGained })}
        </span>
      </span>

      <span aria-hidden="true" className="flex h-1.5 gap-1">
        {Array.from({ length: STRIPES_PER_BELT }, (_, index) => (
          <span
            className={cn(
              "flex-1 rounded-full",
              index < level ? tickClass(color) : "bg-foreground/10",
              index >= level - belt.stripesGained &&
                index < level &&
                "motion-safe:animate-energy-charge origin-left",
            )}
            // oxlint-disable-next-line react/no-array-index-key -- Ticks are the belt's levels, not items.
            key={index}
          />
        ))}
      </span>
    </StepRow>
  );
}

function StreakRow({ count }: { count: number }) {
  const t = useExtracted();

  return (
    <StepRow>
      <ChevronsUpIcon aria-hidden="true" className="text-muted-foreground" />
      <span className="font-medium">{t("{count} right in a row", { count: String(count) })}</span>
    </StepRow>
  );
}

/**
 * What the session earned, around the buddy: Brain Power big, then only what happened: the full
 * meal, a new stripe on the belt and the best streak of right answers.
 */
export function RewardsStep() {
  const t = useExtracted();
  const format = useFormatter();
  const { summary } = useSessionSummary();
  const { belt, bestStreak, brainPower, fullMeal } = summary;
  const hasStripe = belt !== null && belt.stripesGained > 0;
  const hasStreak = bestStreak >= SHOWN_STREAK;

  return (
    <StepCard>
      <RewardsArt />

      <StepTitle>
        {brainPower > 0
          ? t("+{points} Brain Power", { points: format.number(brainPower) })
          : t("Rewards")}
      </StepTitle>

      {(fullMeal || hasStripe || hasStreak) && (
        <StepRows>
          {fullMeal && <FullMealRow />}
          {hasStripe && <BeltRow belt={belt} />}
          {hasStreak && <StreakRow count={bestStreak} />}
        </StepRows>
      )}
    </StepCard>
  );
}
