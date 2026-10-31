"use client";

import { countDoneMissions, isFullMeal } from "@zoonk/core/sessions/missions";
import { cn } from "@zoonk/ui/lib/utils";
import { TargetIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { ListGroup } from "../_components/list-group";
import { SURFACE_CLASS, Surface } from "../_components/surface";
import { FactSegments } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { type BuddyToday } from "../buddies/buddy-status-view";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type DayStep } from "../session/session-types";
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
  const formatDuration = useFormatDuration();
  const left = missions.filter((mission) => mission.status !== "done");
  const minutes = left.reduce((sum, mission) => sum + (mission.minutes ?? 0), 0);

  if (left.length === 0) {
    return t("You earned +{points} Brain Power.", { points: format.number(points) });
  }

  const count =
    left.length === missions.length
      ? t("{count, plural, one {# mission} other {# missions}}", { count: left.length })
      : t("{count, plural, one {# left} other {# left}}", { count: left.length });

  return <FactSegments facts={minutes > 0 ? [count, `~${formatDuration(minutes)}`] : [count]} />;
}

function MissionRow({
  block,
  buddy,
  links,
  mission,
}: {
  block?: DayStep;
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
      detail={done ? null : <MissionStepLine block={block} mission={mission} />}
      mark={<MissionMark block={block} buddy={buddy} done={done} kind={mission.kind} />}
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
      trailing={!done && <MissionRowEnd mission={mission} />}
    />
  );
}

function MissionRowEnd({ mission }: { mission: MissionView }) {
  if (mission.opens?.kind !== "block" || mission.waitReason) {
    return null;
  }

  return <TargetIcon aria-hidden="true" className="text-brain size-3.5" />;
}

function MissionsLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Surface
      className={cn("flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm", className)}
      data-slot="missions-card"
    >
      {children}
    </Surface>
  );
}

export function MissionsCard({
  blockOf,
  brainPower,
  buddy,
  className,
  showBuddy = true,
  collapseWhenDone = false,
  links,
  rowsInQueue = false,
  today,
}: {
  blockOf?: (mission: MissionView) => DayStep | undefined;
  brainPower: number | null;
  buddy: LearnBuddy | null;
  className?: string;
  collapseWhenDone?: boolean;
  links: MissionLinks;
  rowsInQueue?: boolean;
  showBuddy?: boolean;
  today: MissionsDay | null;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const missionName = useMissionName(buddy);
  const titleId = useId();

  if (!today) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("Today's missions start with today's session.")}
      </p>
    );
  }

  const { missions } = today;

  if (missions.length === 0) {
    return null;
  }

  const points = today.fullMeal.bonus;
  const allDone = isFullMeal(missions);
  const won = allDone && today.fullMeal.earned;

  if (today.fullMeal.earned && !allDone) {
    return (
      <MissionsLine className={className}>
        <span className="text-muted-foreground flex-1">
          {t("Today's +{points} Brain Power is already earned.", { points: format.number(points) })}
        </span>
      </MissionsLine>
    );
  }

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
      className={cn(
        SURFACE_CLASS,
        "flex flex-col px-4 pt-3.5 pb-1",
        rowsInQueue && "max-[72rem]:pb-3.5",
        className,
      )}
      data-slot="missions-card"
    >
      <div className="flex items-start gap-2.5">
        {showBuddy && <BuddyFace buddy={buddy} className="mt-0.5 size-6" />}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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

        <BrainPowerReward brainPower={brainPower} earned={won} points={points} />
      </div>

      <MissionTrack className="mt-3.5" missions={missions} />

      <ListGroup className={cn("mt-1.5", rowsInQueue && "max-[72rem]:hidden")}>
        <ul>
          {missions.map((mission) => (
            <li key={mission.kind}>
              <MissionRow
                block={blockOf?.(mission)}
                buddy={buddy}
                links={links}
                mission={mission}
              />
            </li>
          ))}
        </ul>
      </ListGroup>
    </section>
  );
}
