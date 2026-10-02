"use client";

import { type ChallengeMeterState } from "@zoonk/core/library/challenges/run";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, ChevronsDownIcon, ChevronsUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type StepOf } from "../lesson-step-view-props";

type ChallengeContent = StepOf<"challenge">["content"];

/** A change this big reads as "much" higher or lower. */
const BIG_METER_CHANGE = 25;
const METER_MAX = 100;

const METER_ICONS = {
  bigDown: ChevronsDownIcon,
  bigUp: ChevronsUpIcon,
  down: ArrowDownIcon,
  up: ArrowUpIcon,
} as const;

function getMeterMove(change: number): keyof typeof METER_ICONS {
  const isBig = Math.abs(change) >= BIG_METER_CHANGE;

  if (change > 0) {
    return isBig ? "bigUp" : "up";
  }

  return isBig ? "bigDown" : "down";
}

function MeterChange({ meter }: { meter: ChallengeMeterState }) {
  const t = useExtracted();

  if (meter.change === 0) {
    return <span className="text-muted-foreground">{t("no change")}</span>;
  }

  const move = getMeterMove(meter.change);
  const Icon = METER_ICONS[move];
  const isGood = meter.change > 0 === (meter.goodWhen === "high");

  const words: Record<keyof typeof METER_ICONS, string> = {
    bigDown: t("much lower"),
    bigUp: t("much higher"),
    down: t("a bit lower"),
    up: t("a bit higher"),
  };

  return (
    <span
      className={cn(
        "flex items-center gap-1 font-medium",
        isGood ? "text-success" : "text-warning",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {words[move]}
    </span>
  );
}

/**
 * How a pick moved the meters, right under it in the conversation. The meters above announce the
 * same change to screen readers, so this echo is only visual.
 */
export function ChallengeEffectsView({
  choice,
  fill,
  meters,
}: {
  choice: ChallengeContent["nodes"][number]["choices"][number];
  fill: (text: string) => string;
  meters: ChallengeContent["meters"];
}) {
  const moved = choice.effects.flatMap((effect) => {
    const meter = meters.find((item) => item.id === effect.meter);
    return meter && effect.change !== 0 ? [{ ...meter, change: effect.change, value: 0 }] : [];
  });

  if (moved.length === 0) {
    return null;
  }

  return (
    <li
      aria-hidden="true"
      className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs"
      data-slot="challenge-effects"
    >
      {moved.map((meter) => (
        <span className="flex items-center gap-1.5" key={meter.id}>
          <span className="text-muted-foreground">{fill(meter.label)}</span>
          <MeterChange meter={meter} />
        </span>
      ))}
    </li>
  );
}

/** What the decisions move, with how the last one moved each, announced as it changes. */
export function ChallengeMeters({
  fill,
  hasMoved,
  meters,
}: {
  fill: (text: string) => string;
  /** Before the first decision nothing moved yet, so there's no change to show. */
  hasMoved: boolean;
  meters: ChallengeMeterState[];
}) {
  const t = useExtracted();

  if (meters.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={t("How the case is going")}
      aria-live="polite"
      className="bg-muted/50 flex w-full flex-col gap-3 rounded-2xl p-4"
      data-slot="challenge-meters"
    >
      {meters.map((meter) => (
        <div className="flex flex-col gap-1.5" key={meter.id}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{fill(meter.label)}</span>
            {hasMoved && <MeterChange meter={meter} />}
          </div>
          <div
            aria-label={fill(meter.label)}
            aria-valuemax={METER_MAX}
            aria-valuemin={0}
            aria-valuenow={meter.value}
            className="bg-border h-1.5 w-full overflow-hidden rounded-full"
            role="meter"
          >
            <div
              className="bg-foreground/70 h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${meter.value}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
