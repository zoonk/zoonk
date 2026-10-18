"use client";

import { DEFAULT_BUDDY } from "@zoonk/core/profile/default-buddy";
import { type Mission } from "@zoonk/core/sessions/missions";
import { useExtracted, useFormatter } from "next-intl";
import { DoneMark } from "../_components/status-mark";
import { BrainPowerReward } from "./brain-power-reward";
import { useMissionName } from "./mission-copy";
import { MissionTrack } from "./mission-track";

/**
 * The missions a just-finished piece of work completed: each one done before it wasn't. Missions
 * a moment didn't see before (`before` absent) count by what the work reported (`completed`).
 */
function getCompleted({
  before,
  completed,
  missions,
}: {
  before?: readonly Mission[];
  completed?: readonly Mission["kind"][];
  missions: readonly Mission[];
}): Mission[] {
  return missions.filter((mission) => {
    if (mission.status !== "done") {
      return false;
    }

    if (completed) {
      return completed.includes(mission.kind);
    }

    return before?.find((earlier) => earlier.kind === mission.kind)?.status !== "done";
  });
}

/**
 * "✓ Mission done: Finish “Percentages”" at the end of the work that did it (a block of the day,
 * a notebook practice, a pattern drill, a pronunciation round, a call, a question to the buddy),
 * with the day's track filling from where it stood and what's left ("2 of 3 · Left: Fix 3
 * mistakes"). When it was the last one, the reward lights up: "+50 Brain Power from today's
 * missions". Nothing when the work completed none.
 */
export function MissionMoment({
  before,
  brainPower = null,
  buddyName,
  completed,
  fullMeal,
  missions,
}: {
  /** The day's missions before the work, so the track fills from there. */
  before?: readonly Mission[];
  brainPower?: number | null;
  /** The learner's buddy by name, where the screen knows it; otherwise "your buddy". */
  buddyName?: string;
  /** The missions the work completed, when the moment has no `before` to compare with. */
  completed?: readonly Mission["kind"][];
  fullMeal: { bonus: number; paid: boolean };
  missions: readonly Mission[];
}) {
  const t = useExtracted();
  const format = useFormatter();
  const missionName = useMissionName(buddyName ? { ...DEFAULT_BUDDY, name: buddyName } : null);
  const done = getCompleted({ before, completed, missions });

  const nameOf = (mission: Mission) =>
    mission.kind === "askBuddy" && !buddyName
      ? t("Ask your buddy something")
      : missionName(mission);

  // Work outside the day's blocks reports what it completed, not where it started: its track
  // fills the step that completed each one.
  const from =
    before ??
    missions.map((mission) =>
      done.includes(mission) ? { ...mission, done: Math.max(0, mission.total - 1) } : mission,
    );

  if (done.length === 0 && !fullMeal.paid) {
    return null;
  }

  const left = missions.filter((mission) => mission.status !== "done");
  const doneCount = missions.length - left.length;

  return (
    <div className="flex flex-col gap-2.5" data-slot="mission-moment">
      {done.map((mission) => (
        <p className="flex items-start gap-2 text-sm font-medium" key={mission.kind}>
          <DoneMark className="mt-0.5" />
          {t("Mission done: {name}", { name: nameOf(mission) })}
        </p>
      ))}

      <MissionTrack className="max-w-80" from={from} missions={missions} />

      {fullMeal.paid ? (
        <div className="flex items-center gap-2.5 text-sm">
          <BrainPowerReward brainPower={brainPower} earned points={fullMeal.bonus} />
          <span className="text-muted-foreground">{t("from today's missions")}</span>
        </div>
      ) : (
        left.length > 0 && (
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            {t("{done} of {total} · {count, plural, one {Left} other {Left}}: {missions}", {
              count: left.length,
              done: String(doneCount),
              missions: format.list(left.map((mission) => nameOf(mission))),
              total: String(missions.length),
            })}
          </p>
        )
      )}
    </div>
  );
}
