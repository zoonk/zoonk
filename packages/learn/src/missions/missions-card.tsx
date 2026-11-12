"use client";

import { countDoneMissions, isFullMeal } from "@zoonk/core/sessions/missions";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../_components/list-group";
import { SURFACE_CLASS, Surface } from "../_components/surface";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { type BuddyToday } from "../buddies/buddy-status-view";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { BrainPowerReward } from "./brain-power-reward";
import { MissionStepLine, useMissionName, useMissionStateLabel } from "./mission-copy";
import { type MissionLinks, type MissionView, useMissionOpen } from "./mission-links";
import { MissionListRow, ProgressCount } from "./mission-list";
import { BuddyFace, MissionMark } from "./mission-mark";
import { MissionTrack } from "./mission-track";

export type MissionsDay = Pick<BuddyToday, "fullMeal"> & { missions: readonly MissionView[] };

function MissionsStatus({
  missions,
  points,
}: {
  missions: readonly MissionView[];
  points: number;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const left = missions.filter((mission) => mission.status !== "done").length;

  if (left === 0) {
    return t("You earned +{points} Brain Power.", { points: format.number(points) });
  }

  return left === missions.length
    ? t("{count, plural, one {Do # mission} other {Do all #}}", { count: left })
    : t("{count, plural, one {# left} other {# left}}", { count: left });
}

function MissionRow({
  buddy,
  links,
  mission,
}: {
  buddy: LearnBuddy | null;
  links: MissionLinks;
  mission: MissionView;
}) {
  const missionName = useMissionName(buddy);
  const stateLabel = useMissionStateLabel(buddy);
  const done = mission.status === "done";
  const opens = done || mission.waitReason ? undefined : mission.opens;
  const target = useMissionOpen({ links, opens });

  return (
    <MissionListRow
      detail={done ? null : <MissionStepLine mission={mission} />}
      mark={<MissionMark buddy={buddy} done={done} kind={mission.kind} />}
      muted={done || Boolean(mission.waitReason)}
      name={missionName(mission)}
      stateLabel={stateLabel({
        asks: Boolean(links.askBuddy),
        done,
        kind: mission.kind,
        opens,
        waitReason: mission.waitReason,
      })}
      target={target}
    />
  );
}

function MissionsHeading({
  missions,
  points,
  titleId,
  won,
}: {
  missions: readonly MissionView[];
  points: number;
  titleId: string;
  won: boolean;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm leading-snug font-semibold wrap-break-word" id={titleId}>
        {won ? t("Missions done") : t("Today's missions")}
      </h2>
      <p className="text-muted-foreground text-xs leading-snug wrap-break-word tabular-nums">
        <MissionsStatus missions={missions} points={points} />
        <span className="sr-only">
          {", "}
          <ProgressCount done={countDoneMissions(missions)} total={missions.length} />
        </span>
      </p>
    </div>
  );
}

function MissionsLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Surface
      className={cn(TITLE_ROW_CLASS, "min-h-14 gap-y-1 px-4 py-2.5 text-sm", className)}
      data-slot="missions-card"
    >
      {children}
    </Surface>
  );
}

/**
 * One list with one look wherever it shows: every mission is a row, named by what to do, and the
 * reward says what doing them all earns.
 */
export function MissionsCard({
  brainPower,
  buddy,
  className,
  showBuddy = true,
  collapseWhenDone = false,
  links,
  today,
}: {
  brainPower: number | null;
  buddy: LearnBuddy | null;
  className?: string;
  collapseWhenDone?: boolean;
  links: MissionLinks;
  showBuddy?: boolean;
  today: MissionsDay | null;
}) {
  const t = useExtracted();
  const missionName = useMissionName(buddy);
  const titleId = useId();

  if (!today || today.missions.length === 0) {
    return null;
  }

  const { missions } = today;
  const points = today.fullMeal.bonus;
  const allDone = isFullMeal(missions);
  const won = allDone && today.fullMeal.earned;

  if (won && collapseWhenDone) {
    return (
      <MissionsLine className={className}>
        <span className="flex-1 font-medium">
          {t("Missions done")}
          <span className="sr-only">
            {", "}
            {missions.map((mission) => missionName(mission)).join(", ")}
          </span>
        </span>
        <BrainPowerReward brainPower={brainPower} earned points={points} />
      </MissionsLine>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(SURFACE_CLASS, "flex flex-col px-4 pt-3.5 pb-1", className)}
      data-slot="missions-card"
    >
      <div className="flex items-start gap-2.5">
        {showBuddy && <BuddyFace buddy={buddy} className="mt-0.5 size-6" />}

        <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1 items-start gap-y-1")}>
          <MissionsHeading missions={missions} points={points} titleId={titleId} won={won} />
          <BrainPowerReward brainPower={brainPower} earned={won} points={points} />
        </div>
      </div>

      <MissionTrack className="mt-3.5" missions={missions} />

      <ListGroup className="mt-1.5">
        <ul>
          {missions.map((mission) => (
            <li key={mission.kind}>
              <MissionRow buddy={buddy} links={links} mission={mission} />
            </li>
          ))}
        </ul>
      </ListGroup>
    </section>
  );
}
