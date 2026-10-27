"use client";

import { BRAIN_POWER_BONUS } from "@zoonk/core/sessions/brain-power";
import { isFullMeal } from "@zoonk/core/sessions/missions";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronsUpIcon, ListChecksIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BeltTicks } from "../../_components/belt-ticks";
import { BrainPowerReadout } from "../../_components/moment-readouts";
import { StepCard, StepRow, StepRows, StepTitle } from "../../_components/step-card";
import { useBeltName } from "../../_utils/use-belt-name";
import { resolveLearnBuddy, useBuddyName } from "../../buddies/use-buddy-name";
import { type StudySessionSummary } from "../session-types";
import { useSessionSummary } from "./summary-context";

/** A streak worth naming: three right answers in a row or more. */
const SHOWN_STREAK = 3;

type SummaryBelt = NonNullable<StudySessionSummary["belt"]>;

/**
 * Every mission of this session's day done, with the day's bonus earned. The bonus is once a day
 * across goals, so another goal's earning it never says this goal's missions are done.
 */
function hasMissionsDone(summary: StudySessionSummary): boolean {
  return summary.fullMeal && isFullMeal(summary.missions);
}

/**
 * Whether the session earned more than the Brain Power its numbers already show (all of today's
 * missions, a new stripe, a streak worth naming): only then does a phone give the rewards a step
 * of their own. Wide screens show them beside the numbers either way.
 */
export function hasRewardsBeyondBrainPower(summary: StudySessionSummary): boolean {
  return (
    hasMissionsDone(summary) ||
    (summary.belt?.stripesGained ?? 0) > 0 ||
    summary.bestStreak >= SHOWN_STREAK
  );
}

/**
 * The resolved buddy, glad about the day, including before a choice is saved: proud of the
 * session, a beat after the day's Brain Power starts counting up under it, its eyes closing content
 * as its chin lifts and its chest fills (the `zoonk-motion` skill). A revisit draws it still, proud.
 */
function RewardsArt() {
  const t = useExtracted();
  const { buddy: learnerBuddy } = useSessionSummary();
  const buddy = resolveLearnBuddy(learnerBuddy);
  const name = useBuddyName(buddy);

  return (
    <BuddyActor
      beltColor={buddy.beltColor}
      className="size-24"
      energy={buddy.energy}
      expression="happy"
      glasses={buddy.glasses}
      kind={buddy.kind}
      label={t("{buddy}, happy with today", { buddy: name })}
      reaction={{ act: "proud", delay: BEAT_MS }}
      studiedToday
    />
  );
}

/**
 * A reward's value on its row's right, in the mono face: what the session added. Brain Power is in
 * its violet, as every reward amount reads; a level gained is progress made, in blue.
 */
function RewardValue({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "brain" | "progress";
}) {
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-xs font-medium tabular-nums",
        tone === "brain" ? "text-brain-text" : "text-success-text",
      )}
    >
      {children}
    </span>
  );
}

/** Today's missions, all done ("All 3 done", however many the day offered), and their bonus. */
function MissionsBonusRow({ count }: { count: number }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <StepRow>
      <ListChecksIcon aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{t("Today's missions")}</span>
        <span className="text-muted-foreground text-xs">
          {t("{count, plural, one {Done} other {All # done}}", { count })}
        </span>
      </span>
      <RewardValue tone="brain">
        {t("+{bonus}", { bonus: format.number(BRAIN_POWER_BONUS.fullMeal) })}
      </RewardValue>
    </StepRow>
  );
}

/**
 * A stripe earned today: the belt's ten levels as ticks, lit in its color, with the belt and level
 * named and "+1 level" beside it. A new belt color starts over. The ticks hold still: each level
 * already landed at the end of the block that reached it.
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
        <RewardValue tone="progress">
          {t("{count, plural, one {+# level} other {+# levels}}", { count: belt.stripesGained })}
        </RewardValue>
      </span>

      <BeltTicks color={color} level={level} />
    </StepRow>
  );
}

function StreakRow({ count }: { count: number }) {
  const t = useExtracted();

  return (
    <StepRow>
      <ChevronsUpIcon aria-hidden="true" />
      <span className="font-medium">{t("{count} right in a row", { count: String(count) })}</span>
    </StepRow>
  );
}

/** Only what happened, as flat rows: the missions' bonus, a new stripe, the best streak. */
function RewardRows() {
  const { summary } = useSessionSummary();
  const { belt, bestStreak } = summary;
  const missionsDone = hasMissionsDone(summary);
  const hasStripe = belt !== null && belt.stripesGained > 0;
  const hasStreak = bestStreak >= SHOWN_STREAK;

  if (!missionsDone && !hasStripe && !hasStreak) {
    return null;
  }

  return (
    <StepRows>
      {missionsDone && <MissionsBonusRow count={summary.missions.length} />}
      {hasStripe && <BeltRow belt={belt} />}
      {hasStreak && <StreakRow count={bestStreak} />}
    </StepRows>
  );
}

/**
 * What the session earned, with the buddy glad about it: Brain Power as the title, a violet
 * readout (one of the few louder moments), then only what
 * happened as flat rows: the bonus for all of today's missions, a new stripe on the belt and the
 * best streak of right answers. A phone's step when there's more than Brain Power.
 */
export function RewardsStep() {
  const t = useExtracted();
  const { summary } = useSessionSummary();
  const { brainPower } = summary;

  return (
    <StepCard className="items-stretch">
      <RewardsArt />

      <StepTitle>
        {brainPower > 0 ? <BrainPowerReadout points={brainPower} /> : t("Rewards")}
      </StepTitle>

      <RewardRows />
    </StepCard>
  );
}

/**
 * The same rewards in the aside of a wide screen, beside the day's numbers: the buddy, the Brain
 * Power as its violet readout, and the rows. Not the page's heading (the summary's title is).
 */
export function EarnedToday() {
  const { summary } = useSessionSummary();

  return (
    <div className="flex flex-col items-start gap-4" data-slot="earned-today">
      <RewardsArt />
      <p>
        <BrainPowerReadout points={summary.brainPower} />
      </p>
      <RewardRows />
    </div>
  );
}
