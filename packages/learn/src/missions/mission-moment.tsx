"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { Burst } from "@zoonk/ui/components/burst";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { BrainPowerReadout } from "../_components/moment-readouts";
import { BuddyArt } from "../buddies/buddy-art";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { getJustDoneMissions, getMissionMomentKind } from "../session/pick-day-moment";
import { MissionTrack } from "./mission-track";

type MissionMomentFacts = {
  completed: readonly Mission["kind"][];
  fullMeal: { bonus: number; paid: boolean };
  missions: readonly Mission[];
};

function MomentBuddy({ buddy, whole }: { buddy: LearnBuddy | null; whole: boolean }) {
  return (
    <span className="flex shrink-0" data-slot="moment-buddy">
      <BuddyArt
        buddy={buddy}
        className={whole ? "h-28" : "size-12"}
        expression={whole ? "happy" : "neutral"}
        reaction={
          whole ? { act: "cheer", delayMs: 2 * BEAT_MS } : { act: "smile", delayMs: BEAT_MS }
        }
        studiedToday
        view={whole ? "body" : "face"}
      />
    </span>
  );
}

function PaidBonus({ celebrate, points }: { celebrate: boolean; points: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block",
        celebrate && "animate-settle origin-left [--settle-from:0.9]",
      )}
      data-slot="missions-bonus"
      style={celebrate ? { animationDelay: `${2 * BEAT_MS}ms` } : undefined}
    >
      <BrainPowerReadout delayMs={2 * BEAT_MS} hero points={points} />
      <Burst className="text-brain top-5 left-9" delayMs={3 * BEAT_MS} />
    </span>
  );
}

/**
 * Says the missions moved and how many are left; the list itself stays on Today and the buddy's
 * page, where each mission opens.
 */
export function MissionMoment({
  buddy,
  completed,
  fullMeal,
  missions,
}: MissionMomentFacts & { buddy?: LearnBuddy | null }) {
  const t = useExtracted();
  const format = useFormatter();
  const titleId = useId();
  const celebrate = useCelebration();

  const justDone = getJustDoneMissions({ completed, missions });
  const kind = getMissionMomentKind({ completed, fullMeal, missions });

  if (!kind) {
    return null;
  }

  const left = missions.filter((mission) => mission.status !== "done").length;
  const points = format.number(fullMeal.bonus);
  const payoff = kind === "all";

  // The track fills each mission this work completed from the step before it.
  const from = missions.map((mission) =>
    justDone.includes(mission) ? { ...mission, done: Math.max(0, mission.total - 1) } : mission,
  );

  const title =
    left === 0
      ? t("Today's missions done!")
      : t("{count, plural, one {Mission done!} other {# missions done!}}", {
          count: justDone.length,
        });

  const status = () => {
    if (left > 0) {
      return t(
        "{count, plural, one {# more for +{points} Brain Power} other {# more for +{points} Brain Power}}",
        { count: left, points },
      );
    }

    return t("You earned +{points} Brain Power.", { points });
  };

  return (
    <section
      aria-labelledby={titleId}
      className="border-brain/25 bg-brain/5 dark:bg-brain/10 contrast-more:bg-card flex w-full flex-col rounded-xl border p-4"
      data-slot="mission-moment"
    >
      <div className={cn("flex", payoff ? "items-end gap-4" : "items-center gap-3")}>
        {buddy !== undefined && <MomentBuddy buddy={buddy} whole={payoff} />}

        <div className={cn("flex min-w-0 flex-1 flex-col", payoff ? "gap-3" : "gap-0.5")}>
          <div className="flex flex-col gap-0.5" role="status">
            <h3
              className={cn(
                "leading-tight font-semibold text-balance",
                payoff ? "text-xl" : "text-lg",
              )}
              id={titleId}
            >
              {title}
            </h3>
            <p className={cn("text-muted-foreground text-xs", payoff && "sr-only")}>{status()}</p>
          </div>

          {payoff && <PaidBonus celebrate={celebrate} points={fullMeal.bonus} />}
        </div>
      </div>

      <MissionTrack
        className="mt-4"
        delayMs={BEAT_MS}
        from={celebrate ? from : undefined}
        missions={missions}
      />
    </section>
  );
}
