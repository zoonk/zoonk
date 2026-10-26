"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useRef, useState } from "react";
import { ListGroup } from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";
import { MissionStepLine, useMissionName, useMissionStateLabel } from "./mission-copy";
import { MissionListRow } from "./mission-list";
import { MissionMark } from "./mission-mark";
import { MissionTrack } from "./mission-track";
import { type Spark, SparkBurst, useCelebration } from "./spark-burst";

/**
 * The moment's motion, in order: the checks of the missions just done stamp in one after another
 * while their segments of the track fill and, when this work paid the day's bonus, "+50" appears
 * counting up; then the buddy hops and the bonus pops into sparks.
 */
const STAMP_MS = 350;
const STAMP_STAGGER_MS = 120;
const COUNT_FROM_MS = 250;
const COUNT_MS = 450;
const LANDED_MS = COUNT_FROM_MS + COUNT_MS;
const HOP_MS = 320;
const POP_MS = 260;

/** Where the bonus's sparks fly as it lands, in px from its middle. */
const BONUS_SPARKS: readonly Spark[] = [
  { size: 9, x: -38, y: -14 },
  { size: 7, x: -18, y: -32 },
  { size: 10, x: 8, y: -36 },
  { size: 7, x: 32, y: -24 },
  { size: 9, x: 44, y: 2 },
  { size: 6, x: 30, y: 24 },
  { size: 8, x: -6, y: 30 },
  { size: 6, x: -34, y: 18 },
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
 * The learner's buddy, glad about the missions, hopping once as their track fills: its face beside
 * a mission done, the whole buddy when the day's missions are all done. Decorative.
 */
function MomentBuddy({ buddy, whole }: { buddy: LearnBuddy | null; whole: boolean }) {
  const art = useRef<HTMLSpanElement>(null);
  const resolved = resolveLearnBuddy(buddy);

  useCelebration(() => {
    art.current?.animate(
      [
        { transform: "translateY(0)" },
        { offset: 0.4, transform: "translateY(-6px)" },
        { transform: "translateY(0)" },
      ],
      { delay: LANDED_MS, duration: HOP_MS, easing: "ease-out" },
    );
  }, true);

  return (
    <span className="flex shrink-0" ref={art}>
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
 * The day's bonus this work paid, big in Brain Power's violet: "+50" counts up as it lands, pops
 * and bursts into sparks. Screen readers hear it once, in the moment's status.
 */
function PaidBonus({ points }: { points: number }) {
  const t = useExtracted();
  const format = useFormatter();
  const value = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(points);

  useCelebration(() => {
    const start = performance.now() + COUNT_FROM_MS;
    setShown(0);

    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      setShown(Math.round(points * (1 - (1 - progress) ** 2)));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);

    // Hidden until it starts counting, so it never reads "+0".
    value.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      delay: COUNT_FROM_MS,
      duration: 120,
      fill: "backwards",
    });

    value.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
      { delay: LANDED_MS, duration: POP_MS, easing: "ease-out" },
    );
  }, true);

  return (
    <span aria-hidden="true" className="relative flex flex-col items-start gap-1">
      <span
        className="text-brain-text origin-left font-mono text-4xl leading-none font-semibold tabular-nums"
        ref={value}
      >
        {`+${format.number(shown)}`}
      </span>
      <span className="text-muted-foreground text-xs">{t("Brain Power")}</span>
      <SparkBurst className="top-4 left-8" delay={LANDED_MS} sparks={BONUS_SPARKS} />
    </span>
  );
}

/**
 * The end of the work that completed some of the day's missions (a block of the day, a notebook
 * practice, a pattern drill, a pronunciation round, a call, a question to the buddy), as its own
 * moment, on the same violet track Today shows: "Mission done!" with the buddy glad beside it and
 * what's left for the bonus ("1 more for +50 Brain Power"), then the day's missions by name, the
 * ones this work completed stamping their checks ("Just done") and the rest saying where they're
 * done. When it was the last one and the work paid the bonus, the moment is the day's: "Today's
 * missions done!", the whole buddy hopping and "+50" counting up in violet. Nothing when the work
 * completed none.
 */
export function MissionMoment({
  buddy,
  buddyName,
  completed,
  fullMeal,
  missions,
}: {
  /** The learner's buddy, where the screen knows it: it's glad about the missions with them. */
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

  const left = missions.filter((mission) => mission.status !== "done").length;
  const points = format.number(fullMeal.bonus);
  const payoff = left === 0 && fullMeal.paid;

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

          {payoff && <PaidBonus points={fullMeal.bonus} />}
        </div>
      </div>

      <MissionTrack className="mt-4" from={from} missions={missions} />

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
