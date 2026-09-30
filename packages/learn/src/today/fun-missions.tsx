"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, PackageOpenIcon, SparklesIcon, WrenchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { useFormatShare } from "../_utils/percent";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type StudySession } from "../session/session-types";
import { TodayBuddy } from "./today-buddy";
import { useTodayScreen } from "./today-context";

type Mission = StudySession["missions"][number];

const MISSIONS_TITLE_ID = "today-missions-title";
const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MAX_ENERGY = 100;

const MISSION_ICONS = {
  fixMistake: WrenchIcon,
  review: PackageOpenIcon,
  somethingNew: SparklesIcon,
} as const satisfies Record<Mission["kind"], unknown>;

const MISSION_BARS: Record<Mission["kind"], string> = {
  fixMistake: "bg-fun-accent-pink",
  review: "bg-fun-accent-cyan",
  somethingNew: "bg-fun-accent-lime",
};

function isMissionDone(mission: Mission): boolean {
  return mission.status !== "todo";
}

function useMissionCopy() {
  const t = useExtracted();

  return (mission: Mission) => {
    if (mission.kind === "review") {
      return {
        detail:
          mission.status === "nothingToday"
            ? t("No capsules to open today. It still counts.")
            : t("Review · {count, plural, one {# capsule} other {# capsules}}", {
                count: mission.total,
              }),
        short: t("Review"),
        title: t("Open today's capsules"),
      };
    }

    if (mission.kind === "somethingNew") {
      return {
        detail: t("{count, plural, one {# new lesson} other {# new lessons}}", {
          count: mission.total,
        }),
        short: t("Something new"),
        title: t("Finish the new lesson"),
      };
    }

    return {
      detail:
        mission.status === "nothingToday"
          ? t("Nothing to fix today. It still counts.")
          : t("From your mistakes notebook"),
      short: t("Fix a mistake"),
      title: t("Fix a mistake"),
    };
  };
}

function MissionRow({ mission }: { mission: Mission }) {
  const t = useExtracted();
  const copy = useMissionCopy()(mission);
  const Icon = MISSION_ICONS[mission.kind];
  const done = isMissionDone(mission);
  const share = mission.total > 0 ? Math.min(1, mission.done / mission.total) : 1;

  return (
    <li className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
      <div className="flex items-start gap-3">
        <span className="bg-fun-soft flex size-11 shrink-0 items-center justify-center rounded-2xl">
          <Icon aria-hidden="true" className="size-5" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{copy.title}</span>
          <span className="text-fun-fg2 text-sm">{copy.detail}</span>
        </div>

        {done ? (
          <LineMarker>
            <span className="border-fun-accent-lime text-fun-accent-lime flex size-8 items-center justify-center rounded-full border-2">
              <CheckIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">{t("Done")}</span>
            </span>
          </LineMarker>
        ) : (
          <LineMarker>
            <span className="text-sm font-semibold tabular-nums">
              {t("{done}/{total}", { done: String(mission.done), total: String(mission.total) })}
            </span>
          </LineMarker>
        )}
      </div>

      <Meter className="h-2">
        <MeterFill className={MISSION_BARS[mission.kind]} share={done ? 1 : share} />
      </Meter>
    </li>
  );
}

function EnergyRing({ buddy }: { buddy: LearnBuddy }) {
  const filled = Math.min(1, Math.max(0, buddy.energy / MAX_ENERGY));

  return (
    <div className="relative size-24 shrink-0">
      <svg aria-hidden="true" className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle
          className="stroke-fun-track"
          cx="50"
          cy="50"
          fill="none"
          r={RING_RADIUS}
          strokeWidth="6"
        />
        <circle
          className="stroke-fun-energy"
          cx="50"
          cy="50"
          fill="none"
          r={RING_RADIUS}
          strokeDasharray={`${filled * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeLinecap="round"
          strokeWidth="6"
        />
      </svg>
      <TodayBuddy className="absolute inset-2 size-20" buddy={buddy} />
    </div>
  );
}

function BuddyMealText({ bonus, done, buddy }: { bonus: number; done: number; buddy: LearnBuddy }) {
  const t = useExtracted();
  const name = useBuddyName(buddy);

  return t(
    "{name} has had {done} of 3. With all three missions, {name} gets a full meal and you get +{bonus} BP.",
    { bonus: String(bonus), done: String(done), name },
  );
}

function FullMeal({ missions, buddy }: { missions: Mission[]; buddy: LearnBuddy | null }) {
  const t = useExtracted();
  const copy = useMissionCopy();
  const { today } = useTodayScreen();
  const done = missions.filter((mission) => isMissionDone(mission)).length;
  const { bonus, earned } = today.session.fullMeal;

  const waiting = buddy ? (
    <BuddyMealText bonus={bonus} done={done} buddy={buddy} />
  ) : (
    t("{done} of 3 done. All three missions make a full meal: +{bonus} BP.", {
      bonus: String(bonus),
      done: String(done),
    })
  );

  return (
    <div className="fun-glass fun-holo-border flex flex-col gap-4 rounded-3xl p-4">
      <div className="flex items-start gap-3">
        {buddy && <TodayBuddy className="size-16 shrink-0" buddy={buddy} />}

        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">{t("Full meal")}</h3>
          <p className="text-fun-fg2 text-sm" role="status">
            {earned
              ? t("All three missions done: +{bonus} BP.", { bonus: String(bonus) })
              : waiting}
          </p>
        </div>
      </div>

      {/* Each portion keeps its label on one line; a long one moves to its own row instead. */}
      <ul className="flex flex-wrap gap-2">
        {missions.map((mission) => (
          <li
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold whitespace-nowrap",
              isMissionDone(mission)
                ? "bg-fun-soft text-fun-fg"
                : "text-fun-fg2 border-fun-line border border-dashed",
            )}
            key={mission.kind}
          >
            {copy(mission).short}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuddyEnergyLine({ buddy }: { buddy: LearnBuddy }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const name = useBuddyName(buddy);

  // As a share, so "68 %" reads the same as the Energy pill in every language.
  return (
    <p className="text-fun-fg2 text-sm">
      {t("{name}'s Energy: {energy}", {
        energy: formatShare(Math.round(buddy.energy) / MAX_ENERGY),
        name,
      })}
    </p>
  );
}

/**
 * Three missions from today's plan (a review, something new and a fixed mistake) that feed the
 * buddy; all three make a full meal, always the same bonus. They renew at local midnight.
 */
export function FunMissions() {
  const t = useExtracted();
  const { buddy, today } = useTodayScreen();
  const { missions } = today.session;

  return (
    <section aria-labelledby={MISSIONS_TITLE_ID} className="flex flex-col gap-3">
      <header className="flex items-center gap-4">
        {buddy && <EnergyRing buddy={buddy} />}

        <div className="flex flex-col gap-0.5">
          <h2 className="font-fun-display text-2xl font-bold" id={MISSIONS_TITLE_ID}>
            {t("Missions")}
          </h2>
          {buddy && <BuddyEnergyLine buddy={buddy} />}
          <p className="text-fun-fg2 text-xs">{t("New missions at midnight")}</p>
        </div>
      </header>

      <ul className="flex flex-col gap-2.5">
        {missions.map((mission) => (
          <MissionRow key={mission.kind} mission={mission} />
        ))}
      </ul>

      <FullMeal missions={missions} buddy={buddy} />
    </section>
  );
}
