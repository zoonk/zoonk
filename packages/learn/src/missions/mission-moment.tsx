"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Burst } from "@zoonk/ui/components/burst";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS, STAGGER_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../_components/list-group";
import { BrainPowerReadout } from "../_components/moment-readouts";
import { DoneMark } from "../_components/status-mark";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";
import { MissionStepLine, useMissionName, useMissionStateLabel } from "./mission-copy";
import { MissionListRow } from "./mission-list";
import { MissionMark } from "./mission-mark";
import { MissionTrack } from "./mission-track";

/** What the work did to the day's missions, as its end shows it. */
type MissionMomentFacts = {
  /** The missions the work completed. */
  completed: readonly Mission["kind"][];
  fullMeal: { bonus: number; paid: boolean };
  missions: readonly Mission[];
};

/** The missions this work completed, as they're listed. */
function getJustDone({
  completed,
  missions,
}: Pick<MissionMomentFacts, "completed" | "missions">): readonly Mission[] {
  return missions.filter(
    (mission) => mission.status === "done" && completed.includes(mission.kind),
  );
}

/** It completed one of the day's missions, or paid the day's bonus: the work's end says so. */
function hasMissionMoment(facts: MissionMomentFacts): boolean {
  return getJustDone(facts).length > 0 || facts.fullMeal.paid;
}

/** The day's last mission, with the bonus paid: the day's payoff, the loudest version. */
function isPayoff({ fullMeal, missions }: MissionMomentFacts): boolean {
  return fullMeal.paid && missions.every((mission) => mission.status === "done");
}

/**
 * When what the work reached after its missions (a level, Energy) starts moving: the beat after
 * the missions' last one, so one thing moves at a time. The missions' checks land on the first
 * beat; the day's payoff adds the bonus on the second and its burst on the third.
 */
export function getAfterMissionsDelay(facts: MissionMomentFacts | null): number {
  if (!facts || !hasMissionMoment(facts)) {
    return BEAT_MS;
  }

  return isPayoff(facts) ? 3 * BEAT_MS : 2 * BEAT_MS;
}

/** A mission's check landing, the moment it turns done; the next ones a stagger apart. */
function StampedMark({ celebrate, order }: { celebrate: boolean; order: number }) {
  return (
    <span
      className={cn("flex", celebrate && "animate-settle")}
      data-slot="mission-stamp"
      style={celebrate ? { animationDelay: `${BEAT_MS + order * STAGGER_MS}ms` } : undefined}
    >
      <DoneMark className="size-3.5" />
    </span>
  );
}

/**
 * The learner's buddy, glad about the missions: its face beside a mission done, and the whole
 * buddy when the day's missions are all done. It holds still, cheering from the first frame: a
 * character never moves as one block (the `zoonk-motion` skill). Decorative.
 */
function MomentBuddy({ buddy, whole }: { buddy: LearnBuddy | null; whole: boolean }) {
  const resolved = resolveLearnBuddy(buddy);

  return (
    <span className="flex shrink-0" data-slot="moment-buddy">
      <Buddy
        beltColor={resolved.beltColor}
        className={whole ? "size-24" : "size-12"}
        crop={whole ? undefined : "face"}
        energy={resolved.energy}
        expression="cheer"
        glasses={resolved.glasses}
        kind={resolved.kind}
        studiedToday
      />
    </span>
  );
}

/**
 * The day's bonus this work paid, as every Brain Power earned reads (`BrainPowerReadout`): "+50" a
 * violet readout with "Brain Power" beside it. It lands whole on its beat (its words never wait
 * alone for their number) and counts up, then one burst of violet sparks flies from it, the day's
 * rarest beat. Screen readers hear it once, in the moment's status.
 */
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
      <BrainPowerReadout delay={2 * BEAT_MS} points={points} />
      <Burst className="text-brain top-5 left-9" delay={3 * BEAT_MS} />
    </span>
  );
}

/**
 * The end of the work that completed some of the day's missions (a block of the day, a notebook
 * practice, a pattern drill, a pronunciation round, a call, a question to the buddy), as its own
 * moment, on the same violet track Today shows: "Mission done!" with the buddy glad beside it and
 * what's left for the bonus ("1 more for +50 Brain Power"), then the day's missions by name, the
 * ones this work completed landing their checks ("Just done") as their part of the track fills,
 * and the rest saying where they're done. When it was the last one and the work paid the bonus,
 * the moment is the day's: "Today's missions done!", the whole buddy cheering as "+50" counts up
 * in violet, then one burst. Nothing when the work completed none.
 */
export function MissionMoment({
  buddy,
  buddyName,
  completed,
  fullMeal,
  missions,
}: MissionMomentFacts & {
  /** The learner's buddy, where the screen knows it: it's glad about the missions with them. */
  buddy?: LearnBuddy | null;
  /**
   * The buddy's name, where the screen knows only that (its own conversation, its face already
   * beside its words), so a question to it is named.
   */
  buddyName?: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const titleId = useId();
  const celebrate = useCelebration();

  const named =
    buddy === undefined && buddyName ? { ...resolveLearnBuddy(null), name: buddyName } : buddy;

  const missionName = useMissionName(named ?? null);
  const stateLabel = useMissionStateLabel(named ?? null);
  const justDone = getJustDone({ completed, missions });

  if (!hasMissionMoment({ completed, fullMeal, missions })) {
    return null;
  }

  const left = missions.filter((mission) => mission.status !== "done").length;
  const points = format.number(fullMeal.bonus);
  const payoff = isPayoff({ completed, fullMeal, missions });

  // The track fills each mission this work completed from the step before it.
  const from = missions.map((mission) =>
    justDone.includes(mission) ? { ...mission, done: Math.max(0, mission.total - 1) } : mission,
  );

  const nameOf = (mission: Mission) =>
    mission.kind === "askBuddy" && named === undefined
      ? t("Ask your buddy something")
      : missionName(mission);

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

    return fullMeal.paid
      ? t("You earned +{points} Brain Power.", { points })
      : t("Today's +{points} Brain Power is already earned.", { points });
  };

  return (
    <section
      aria-labelledby={titleId}
      className="border-brain/25 bg-brain/5 dark:bg-brain/10 contrast-more:bg-card flex w-full flex-col rounded-xl border px-4 pt-4 pb-1"
      data-slot="mission-moment"
    >
      <div className={cn("flex items-center", payoff ? "gap-4" : "gap-3")}>
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
        delay={BEAT_MS}
        from={celebrate ? from : undefined}
        missions={missions}
      />

      <ListGroup className="mt-1.5">
        <ul>
          {missions.map((mission) => {
            const done = mission.status === "done";
            const order = justDone.indexOf(mission);
            const now = order !== -1;

            return (
              <li key={mission.kind}>
                <MissionListRow
                  detail={done ? null : <MissionStepLine mission={mission} />}
                  mark={
                    now ? (
                      <StampedMark celebrate={celebrate} order={order} />
                    ) : (
                      <MissionMark buddy={named ?? null} done={done} kind={mission.kind} />
                    )
                  }
                  muted={done && !now}
                  name={nameOf(mission)}
                  stateLabel={
                    now ? undefined : stateLabel({ asks: false, done, kind: mission.kind })
                  }
                  target={null}
                  trailing={
                    now && (
                      <span className="text-success-text font-sans text-xs font-medium">
                        {t("Just done")}
                      </span>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      </ListGroup>
    </section>
  );
}
