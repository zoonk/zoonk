"use client";

import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
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
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";
import { type StudyMomentView } from "./session-types";

type Reached = StudyMomentView["reached"];

const PERCENT = 100;

const LIGHT_BELTS: ReadonlySet<BeltColor> = new Set(["white", "yellow", "orange"]);

/** Where the buddy starts glowing (`getBuddyEnergyState`). */
const GLOWING_ENERGY = 80;
const MAX_ENERGY = 100;

type RowMotion = { delay: number } | null;

function beatStyle(motion: RowMotion): React.CSSProperties | undefined {
  return motion ? { animationDelay: `${motion.delay}ms` } : undefined;
}

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
          <span className="font-semibold text-balance">{title}</span>
          <span className="text-muted-foreground text-xs text-pretty">{detail}</span>
        </span>
      </span>
      {bar}
    </StepRow>
  );
}

function LevelBadge({
  color,
  level,
  motion,
}: {
  color: BeltColor;
  level: number;
  motion: RowMotion;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums",
        "ring-1 ring-black/10 ring-inset dark:ring-white/10",
        motion && "animate-settle",
        beltColorClasses[color],
        LIGHT_BELTS.has(color) ? "text-black/80" : "text-white",
      )}
      data-slot="level-badge"
      style={beatStyle(motion)}
    >
      {level}
    </span>
  );
}

function LevelReached({
  level,
  motion,
}: {
  level: NonNullable<Reached["level"]>;
  motion: RowMotion;
}) {
  const t = useExtracted();
  const beltName = useBeltName();

  return (
    <ReachedRow
      bar={
        <BeltTicks
          color={level.color}
          delay={motion?.delay}
          filling={motion ? 1 : 0}
          level={level.level}
        />
      }
      detail={t("{belt}, level {level}", {
        belt: beltName(level.color),
        level: String(level.level),
      })}
      mark={<LevelBadge color={level.color} level={level.level} motion={motion} />}
      slot="reached-level"
      title={t("Level up!")}
    />
  );
}

/** Its bar shows where Energy is now, never filling from empty: the moment doesn't know where it came from. */
function EnergyReached({
  buddy,
  energy,
  motion,
}: {
  buddy?: LearnBuddy | null;
  energy: number;
  motion: RowMotion;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const name = useBuddyName(resolveLearnBuddy(buddy ?? null));
  const share = formatShare(energy / PERCENT);
  const max = energy >= MAX_ENERGY;

  const detail = () => {
    if (max) {
      return buddy === undefined
        ? t("As high as Energy goes.")
        : t("{buddy} is glowing as bright as it gets.", { buddy: name });
    }

    if (energy === GLOWING_ENERGY && buddy !== undefined) {
      return t("{buddy} is glowing now.", { buddy: name });
    }

    return t("Right answers raise it. A day away lowers it a little.");
  };

  return (
    <ReachedRow
      bar={
        <Meter>
          <MeterFill className="bg-energy" share={energy / PERCENT} />
        </Meter>
      }
      detail={detail()}
      mark={
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center"
          data-slot="energy-mark"
        >
          <ZapIcon
            className={cn("text-energy size-5", motion && "animate-pop")}
            style={beatStyle(motion)}
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

export function ReachedMoment({
  buddy,
  ceremony,
  delay,
  reached,
}: {
  buddy?: LearnBuddy | null;
  ceremony: Pick<CeremonyMilestone, "kind"> | null;
  delay: number;
  reached: Reached;
}) {
  const celebrate = useCelebration();
  const level = ceremony?.kind === "belt" ? null : reached.level;

  if (!level && reached.energy === null) {
    return null;
  }

  const energyDelay = level ? delay + BEAT_MS : delay;

  return (
    <StepRows data-slot="reached-moment">
      {level && <LevelReached level={level} motion={celebrate ? { delay } : null} />}
      {reached.energy !== null && (
        <EnergyReached
          buddy={buddy}
          energy={reached.energy}
          motion={celebrate ? { delay: energyDelay } : null}
        />
      )}
    </StepRows>
  );
}
