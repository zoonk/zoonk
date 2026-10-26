"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { Buddy } from "@zoonk/ui/components/buddy";
import { CheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useRef } from "react";
import { ListGroup } from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";
import { MissionsRing } from "../buddies/missions-ring";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";
import { BrainPowerReward } from "./brain-power-reward";
import { useMissionName, useMissionStateLabel } from "./mission-copy";
import { MissionListRow, ProgressCount } from "./mission-list";
import { MissionMark } from "./mission-mark";
import { type Spark, SparkBurst, useCelebration } from "./spark-burst";

/**
 * The moment's motion, in order: the checks of the missions just done stamp in one after another,
 * the ring fills their arcs and the buddy pops with a burst of sparks (the ring's own timing), then
 * the reward lights up with a burst of its own when this work paid it.
 */
const STAMP_MS = 420;
const STAMP_STAGGER_MS = 140;
const RING_FILLED_MS = 900;
const PAYOUT_MS = 1150;

/** Where the buddy's sparks fly as its missions ring fills, in px from its middle. */
const EMBLEM_SPARKS: readonly Spark[] = [
  { size: 9, x: -40, y: -18 },
  { size: 7, x: -22, y: -40 },
  { size: 10, x: 6, y: -46 },
  { size: 7, x: 32, y: -32 },
  { size: 9, x: 44, y: -4 },
  { size: 6, x: 34, y: 28 },
  { size: 8, x: -8, y: 42 },
  { size: 6, x: -38, y: 24 },
];

/** Where the reward's sparks fly as it lights up. */
const REWARD_SPARKS: readonly Spark[] = [
  { size: 8, x: -30, y: -12 },
  { size: 6, x: -10, y: -26 },
  { size: 9, x: 16, y: -30 },
  { size: 6, x: 29, y: -8 },
  { size: 7, x: 27, y: 16 },
  { size: 6, x: -25, y: 14 },
];

/** A mission's check stamping in, the moment it turns done. */
function StampedMark({ order }: { order: number }) {
  const mark = useRef<HTMLSpanElement>(null);

  useCelebration(() => {
    mark.current?.animate(
      [
        { opacity: 0, transform: "scale(0.3)" },
        { offset: 0.6, opacity: 1, transform: "scale(1.3)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        delay: order * STAMP_STAGGER_MS,
        duration: STAMP_MS,
        easing: "ease-out",
        fill: "backwards",
      },
    );
  }, true);

  return (
    <span className="flex" ref={mark}>
      <DoneMark className="size-3.5" />
    </span>
  );
}

/**
 * The day's reward beside the moment: "+50 Brain Power", lit once this work paid it, popping with a
 * burst of sparks as it lights.
 */
function MomentReward({
  brainPower,
  paid,
  points,
}: {
  brainPower: number | null;
  paid: boolean;
  points: number;
}) {
  const reward = useRef<HTMLSpanElement>(null);

  useCelebration(() => {
    reward.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }],
      { delay: PAYOUT_MS, duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, paid);

  return (
    <span className="relative shrink-0" ref={reward}>
      <BrainPowerReward brainPower={brainPower} earned={paid} points={points} />
      {paid && <SparkBurst className="top-2.5 right-6" delay={PAYOUT_MS} sparks={REWARD_SPARKS} />}
    </span>
  );
}

/**
 * The learner's buddy cheering inside the day's missions ring, the ring filling the arcs of the
 * missions just done; a check in the buddy's place where the screen doesn't know the buddy.
 */
function MomentEmblem({
  buddy,
  done,
  from,
  total,
}: {
  buddy?: LearnBuddy | null;
  done: number;
  from: number;
  total: number;
}) {
  const resolved = buddy === undefined ? null : resolveLearnBuddy(buddy);

  return (
    <span className="relative shrink-0">
      <MissionsRing className="size-16" from={from} missions={{ done, total }} strokeWidth={2.5}>
        {resolved ? (
          <Buddy
            beltColor={resolved.beltColor}
            className="size-12"
            crop="face"
            energy={resolved.energy}
            expression="cheer"
            glasses={resolved.glasses}
            kind={resolved.kind}
            studiedToday
          />
        ) : (
          <CheckIcon aria-hidden="true" className="text-success size-7" strokeWidth={3} />
        )}
      </MissionsRing>

      {done > from && (
        <SparkBurst className="top-1/2 left-1/2" delay={RING_FILLED_MS} sparks={EMBLEM_SPARKS} />
      )}
    </span>
  );
}

/**
 * The end of the work that completed some of the day's missions (a block of the day, a notebook
 * practice, a pattern drill, a pronunciation round, a call, a question to the buddy), as its own
 * moment: the buddy cheering inside the day's missions ring as their arcs fill, "Mission done!"
 * (or "All 3 missions done!"), and the day's missions by name, the ones this work completed
 * stamping their checks and saying so, the rest as they stand. The reward ("+50 Brain Power")
 * sits beside it and lights up with a burst when this work paid it. Nothing when the work
 * completed none.
 */
export function MissionMoment({
  brainPower = null,
  buddy,
  buddyName,
  completed,
  fullMeal,
  missions,
}: {
  brainPower?: number | null;
  /** The learner's buddy, where the screen knows it: it cheers in the moment. */
  buddy?: LearnBuddy | null;
  /**
   * The buddy's name, where the screen knows only that (its own conversation, its face already
   * beside its words), so a question to it is named.
   */
  buddyName?: string;
  /** The missions the work completed. */
  completed: readonly Mission["kind"][];
  fullMeal: { bonus: number; paid: boolean };
  missions: readonly Mission[];
}) {
  const t = useExtracted();
  const format = useFormatter();
  const titleId = useId();

  const named =
    buddy === undefined && buddyName ? { ...resolveLearnBuddy(null), name: buddyName } : buddy;

  const missionName = useMissionName(named ?? null);
  const stateLabel = useMissionStateLabel(named ?? null);

  const justDone = missions.filter(
    (mission) => mission.status === "done" && completed.includes(mission.kind),
  );

  if (justDone.length === 0 && !fullMeal.paid) {
    return null;
  }

  const doneCount = missions.filter((mission) => mission.status === "done").length;
  const left = missions.length - doneCount;
  const points = format.number(fullMeal.bonus);

  const nameOf = (mission: Mission) =>
    mission.kind === "askBuddy" && named === undefined
      ? t("Ask your buddy something")
      : missionName(mission);

  const title =
    left === 0
      ? t("{count, plural, one {Mission done!} other {All # missions done!}}", {
          count: missions.length,
        })
      : t("{count, plural, one {Mission done!} other {# missions done!}}", {
          count: justDone.length,
        });

  const status = () => {
    if (left > 0) {
      return t("{count, plural, one {# left} other {# left}}", { count: left });
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
      <div className="flex items-center gap-3">
        <MomentEmblem
          buddy={buddy}
          done={doneCount}
          from={doneCount - justDone.length}
          total={missions.length}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-lg leading-tight font-semibold text-balance" id={titleId}>
            {title}
          </h3>
          <p className="text-muted-foreground text-xs leading-snug text-pretty">{status()}</p>
        </div>

        {(left > 0 || fullMeal.paid) && (
          <MomentReward brainPower={brainPower} paid={fullMeal.paid} points={fullMeal.bonus} />
        )}
      </div>

      <ListGroup className="mt-2">
        <ul>
          {missions.map((mission) => {
            const done = mission.status === "done";
            const order = justDone.indexOf(mission);
            const now = order !== -1;

            return (
              <li key={mission.kind}>
                <MissionListRow
                  detail={null}
                  mark={
                    now ? (
                      <StampedMark order={order} />
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
                    now ? (
                      <span className="text-success-text font-sans text-xs font-medium">
                        {t("Just done")}
                      </span>
                    ) : (
                      !done &&
                      mission.total > 1 && (
                        <ProgressCount done={mission.done} total={mission.total} />
                      )
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
