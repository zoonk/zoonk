"use client";

import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { BeltTicks } from "../_components/belt-ticks";
import { Meter, MeterFill } from "../_components/meter";
import { StepRow, StepRows } from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { useBeltName } from "../_utils/use-belt-name";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type StudyMomentView } from "./session-types";

type Reached = StudyMomentView["reached"];

const PERCENT = 100;

/** Belts light enough that their level number reads in dark ink; the rest take white. */
const LIGHT_BELTS: ReadonlySet<BeltColor> = new Set(["white", "yellow", "orange"]);

/** Energy from which the buddy glows (`getBuddyEnergyState`): reaching it is the buddy's moment. */
const GLOWING_ENERGY = 80;
const MAX_ENERGY = 100;

/**
 * When each row's one motion plays: after the missions above have stamped in and their bonus has
 * landed, the level first and then Energy, so they read in order instead of all at once.
 */
const LEVEL_DELAY_CLASS = "[animation-delay:700ms]";
const LEVEL_TICKS_DELAY_CLASS = "*:[animation-delay:700ms]";
const ENERGY_DELAY_CLASS = "[animation-delay:950ms]";

/** One thing the block took the learner to, as a row: its mark, what it is, one line, a bar. */
function ReachedRow({
  bar,
  detail,
  mark,
  slot,
  title,
}: {
  bar: React.ReactNode;
  detail: string;
  mark: React.ReactNode;
  slot: string;
  title: string;
}) {
  return (
    <StepRow className="flex-col items-stretch gap-2" data-slot={slot}>
      <span className="flex items-center gap-3">
        {mark}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium text-balance">{title}</span>
          <span className="text-muted-foreground text-xs text-pretty">{detail}</span>
        </span>
      </span>
      {bar}
    </StepRow>
  );
}

/** The new level's number on its belt's color, with a firm edge, pulsing once as it's reached. */
function LevelBadge({ color, level }: { color: BeltColor; level: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums",
        "motion-safe:animate-pulse-scale ring-1 ring-black/10 ring-inset dark:ring-white/10",
        LEVEL_DELAY_CLASS,
        beltColorClasses[color],
        LIGHT_BELTS.has(color) ? "text-black/80" : "text-white",
      )}
    >
      {level}
    </span>
  );
}

/** A new belt level: "Level up!", the belt and level, and its ten ticks with the new one charging. */
function LevelReached({ level }: { level: NonNullable<Reached["level"]> }) {
  const t = useExtracted();
  const beltName = useBeltName();

  return (
    <ReachedRow
      bar={
        <BeltTicks
          className={LEVEL_TICKS_DELAY_CLASS}
          color={level.color}
          gained={1}
          level={level.level}
        />
      }
      detail={t("{belt}, level {level}", {
        belt: beltName(level.color),
        level: String(level.level),
      })}
      mark={<LevelBadge color={level.color} level={level.level} />}
      slot="reached-level"
      title={t("Level up!")}
    />
  );
}

/**
 * A new tenth of Energy, said as its number ("Energy at 60%"), with what it means: the buddy
 * glowing from 80%, or the most it goes at 100%. Its bar shows where Energy is now, never filling
 * from empty, since a block moves it only a little; its bolt pulses once for the step.
 */
function EnergyReached({ buddy, energy }: { buddy?: LearnBuddy | null; energy: number }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const name = useBuddyName(resolveLearnBuddy(buddy ?? null));
  const share = formatShare(energy / PERCENT);
  const max = energy >= MAX_ENERGY;

  const detail = () => {
    if (max) {
      return t("Right answers keep it there. A day away lowers it a little.");
    }

    if (energy === GLOWING_ENERGY && buddy !== undefined) {
      return t("{buddy} is glowing now.", { buddy: name });
    }

    return t("Right answers raise it. A day away lowers it a little.");
  };

  return (
    <ReachedRow
      bar={
        <Meter className="bg-surface-3 h-1 rounded-[2px]">
          <MeterFill className="bg-energy rounded-[2px]" share={energy / PERCENT} />
        </Meter>
      }
      detail={detail()}
      mark={
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center">
          <ZapIcon
            className={cn("text-energy motion-safe:animate-pulse-scale size-5", ENERGY_DELAY_CLASS)}
          />
        </span>
      }
      slot="reached-energy"
      title={
        max
          ? t("Max Energy: {energy}", { energy: share })
          : t("Energy at {energy}", { energy: share })
      }
    />
  );
}

/**
 * What the block took the learner to, as flat rows under its missions: a new belt level and a new
 * tenth of Energy. A new belt color gets its full-screen ceremony instead, so its level isn't said
 * twice. Nothing when the block reached neither.
 */
export function ReachedMoment({
  buddy,
  ceremony,
  reached,
}: {
  buddy?: LearnBuddy | null;
  /** The block's full-screen ceremony: a new belt already celebrates its level. */
  ceremony: StudyMomentView["ceremony"];
  reached: Reached;
}) {
  const level = ceremony?.kind === "belt" ? null : reached.level;

  if (!level && reached.energy === null) {
    return null;
  }

  return (
    <StepRows data-slot="reached-moment">
      {level && <LevelReached level={level} />}
      {reached.energy !== null && <EnergyReached buddy={buddy} energy={reached.energy} />}
    </StepRows>
  );
}
