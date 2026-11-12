"use client";

import { beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { BELT_COLORS_ORDER, type BeltColor, LEVELS_PER_COLOR } from "@zoonk/utils/belt-level";
import { ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { BeltTicks } from "../_components/belt-ticks";
import { Meter, MeterFill } from "../_components/meter";
import { StepRow, StepRows } from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { useBeltName, useBeltStep } from "../_utils/use-belt-name";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type StudyMomentView } from "./session-types";

type Reached = StudyMomentView["reached"];

const PERCENT = 100;

const LIGHT_BELTS: ReadonlySet<BeltColor> = new Set(["white", "yellow", "orange"]);

type RowMotion = { delayMs: number } | null;

function beatStyle(motion: RowMotion): React.CSSProperties | undefined {
  return motion ? { animationDelay: `${motion.delayMs}ms` } : undefined;
}

function ReachedRow({
  bar,
  detail,
  mark,
  slot,
  title,
}: {
  bar: React.ReactNode;
  detail: string | null;
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
          {detail && <span className="text-muted-foreground text-xs text-pretty">{detail}</span>}
        </span>
      </span>
      {bar}
    </StepRow>
  );
}

function BeltBadge({
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
      data-slot="belt-badge"
      style={beatStyle(motion)}
    >
      {level}
    </span>
  );
}

/** How many numbers are left before the next belt, which starts after this belt's last one. */
function useNextBeltLine() {
  const t = useExtracted();
  const beltName = useBeltName();

  function describe({ color, level }: NonNullable<Reached["level"]>): string | null {
    const next = BELT_COLORS_ORDER[BELT_COLORS_ORDER.indexOf(color) + 1];

    if (!next) {
      return null;
    }

    return t({
      description:
        'Under a belt and its number, such as "White belt 4": how many numbers are left before the next belt. {belt} is that belt\'s name, such as "Yellow belt".',
      message: "{count, plural, one {# more to {belt}} other {# more to {belt}}}",
      values: { belt: beltName(next), count: LEVELS_PER_COLOR - level + 1 },
    });
  }

  return describe;
}

function BeltReached({
  level,
  motion,
}: {
  level: NonNullable<Reached["level"]>;
  motion: RowMotion;
}) {
  const beltStep = useBeltStep();
  const nextBeltLine = useNextBeltLine();

  return (
    <ReachedRow
      bar={
        <BeltTicks
          color={level.color}
          delayMs={motion?.delayMs}
          filling={motion ? 1 : 0}
          level={level.level}
        />
      }
      detail={nextBeltLine(level)}
      mark={<BeltBadge color={level.color} level={level.level} motion={motion} />}
      slot="reached-belt"
      title={beltStep(level)}
    />
  );
}

/**
 * Its bar shows where Energy is now, never filling from empty: the moment doesn't know where it
 * came from.
 */
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
  const energyLine = t("Energy at {energy}", { energy: formatShare(energy / PERCENT) });

  return (
    <ReachedRow
      bar={
        <Meter>
          <MeterFill className="bg-energy" share={energy / PERCENT} />
        </Meter>
      }
      detail={buddy === undefined ? null : energyLine}
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
      title={buddy === undefined ? energyLine : t("{buddy} is glowing", { buddy: name })}
    />
  );
}

/** One row: the belt's new number, or the buddy glowing. The day's moment picks which. */
export function ReachedMoment({
  buddy,
  reached,
  show,
}: {
  buddy?: LearnBuddy | null;
  reached: Reached;
  show: "belt" | "glow";
}) {
  const celebrate = useCelebration();
  const motion = celebrate ? { delayMs: BEAT_MS } : null;

  return (
    <StepRows data-slot="reached-moment">
      {show === "belt" && reached.level && <BeltReached level={reached.level} motion={motion} />}
      {show === "glow" && reached.energy !== null && (
        <EnergyReached buddy={buddy} energy={reached.energy} motion={motion} />
      )}
    </StepRows>
  );
}
