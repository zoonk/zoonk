"use client";

import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { BeltTicks } from "../_components/belt-ticks";
import { Meter, MeterFill } from "../_components/meter";
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

/** One thing the block took the learner to, on its own panel: its mark, a headline and one line. */
function ReachedCard({
  children,
  detail,
  mark,
  title,
}: {
  children?: React.ReactNode;
  detail: string;
  mark: React.ReactNode;
  title: string;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="bg-card flex w-full flex-col gap-3 rounded-xl border px-4 py-4"
      data-slot="reached-moment"
    >
      <div className="flex items-center gap-3">
        {mark}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5" role="status">
          <h3 className="text-lg leading-tight font-semibold text-balance" id={titleId}>
            {title}
          </h3>
          <p className="text-muted-foreground text-xs text-pretty">{detail}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The new level's number on its belt's color, with a firm edge, popping in as it's reached. */
function LevelBadge({ color, level }: { color: BeltColor; level: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full font-mono text-base font-semibold tabular-nums",
        "motion-safe:animate-pulse-scale ring-1 ring-black/10 ring-inset dark:ring-white/10",
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
    <ReachedCard
      detail={t("{belt}, level {level}", {
        belt: beltName(level.color),
        level: String(level.level),
      })}
      mark={<LevelBadge color={level.color} level={level.level} />}
      title={t("Level up!")}
    >
      <BeltTicks color={level.color} gained={1} level={level.level} />
    </ReachedCard>
  );
}

/**
 * A new tenth of Energy, the buddy's: "Max Energy!" at the top, "Zu is glowing!" as it starts to
 * glow, "60% Energy" for the rest, with its amber bar charging up to it.
 */
function EnergyReached({ buddy, energy }: { buddy?: LearnBuddy | null; energy: number }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const resolved = resolveLearnBuddy(buddy ?? null);
  const name = useBuddyName(resolved);
  const share = formatShare(energy / PERCENT);

  const title = () => {
    if (energy >= MAX_ENERGY) {
      return t("Max Energy!");
    }

    if (energy === GLOWING_ENERGY && buddy !== undefined) {
      return t("{buddy} is glowing!", { buddy: name });
    }

    return t("{energy} Energy", { energy: share });
  };

  return (
    <ReachedCard
      detail={t("Right answers raise it. A day away lowers it a little.")}
      mark={
        buddy === undefined ? null : (
          <Buddy
            beltColor={resolved.beltColor}
            className="size-12 shrink-0"
            energy={energy}
            expression="cheer"
            glasses={resolved.glasses}
            kind={resolved.kind}
            studiedToday
          />
        )
      }
      title={title()}
    >
      <Meter className="bg-surface-3 h-1 rounded-[2px]">
        <MeterFill
          className="bg-energy motion-safe:animate-energy-charge origin-left rounded-[2px]"
          share={energy / PERCENT}
        />
      </Meter>
    </ReachedCard>
  );
}

/**
 * What the block took the learner to, under its missions: a new belt level and a new tenth of
 * Energy, each a small celebration of its own. A new belt color gets its full-screen ceremony
 * instead, so its level isn't said twice. Nothing when the block reached neither.
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
  const belt = ceremony?.kind === "belt";

  return (
    <>
      {reached.level && !belt && <LevelReached level={reached.level} />}
      {reached.energy !== null && <EnergyReached buddy={buddy} energy={reached.energy} />}
    </>
  );
}
