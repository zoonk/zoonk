"use client";

import { countDoneMissions, isFullMeal } from "@zoonk/core/sessions/missions";
import { FoldChevron } from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
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

function MissionsStatus({ missions }: { missions: readonly MissionView[] }) {
  const t = useExtracted();
  const done = countDoneMissions(missions);

  if (done === missions.length) {
    return null;
  }

  return t("{done} of {total} done", { done: String(done), total: String(missions.length) });
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

type RowsFold = { listId: string; onToggle: () => void; open: boolean };

function MissionsTitle({ fold, won }: { fold: RowsFold | null; won: boolean }) {
  const t = useExtracted();
  const title = won ? t("Missions done") : t("Today's missions");

  if (!fold) {
    return title;
  }

  return (
    <button
      aria-controls={fold.listId}
      aria-expanded={fold.open}
      className="hit-area focus-visible:ring-ring/50 relative flex items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-[3px]"
      onClick={fold.onToggle}
      type="button"
    >
      {title}
      <FoldChevron className="text-muted-foreground" inline />
    </button>
  );
}

function MissionsHeading({
  fold,
  missions,
  titleId,
  won,
}: {
  fold: RowsFold | null;
  missions: readonly MissionView[];
  titleId: string;
  won: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-sm leading-snug font-semibold wrap-break-word" id={titleId}>
        <MissionsTitle fold={fold} won={won} />
      </h2>
      <p className="text-muted-foreground text-xs leading-snug wrap-break-word tabular-nums empty:hidden">
        <MissionsStatus missions={missions} />
      </p>
      {isFullMeal(missions) && (
        <span className="sr-only">
          <ProgressCount done={missions.length} total={missions.length} />
        </span>
      )}
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
 * reward says what doing them all earns. Today folds the rows behind the title (`foldRows`),
 * since most of them are already rows of the day's list right above the card.
 */
export function MissionsCard({
  brainPower,
  buddy,
  className,
  showBuddy = true,
  collapseWhenDone = false,
  foldRows = false,
  links,
  today,
}: {
  brainPower: number | null;
  buddy: LearnBuddy | null;
  className?: string;
  collapseWhenDone?: boolean;
  foldRows?: boolean;
  links: MissionLinks;
  showBuddy?: boolean;
  today: MissionsDay | null;
}) {
  const t = useExtracted();
  const missionName = useMissionName(buddy);
  const titleId = useId();
  const listId = useId();
  const [unfolded, setUnfolded] = useState(false);
  const open = !foldRows || unfolded;

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
      className={cn(
        SURFACE_CLASS,
        "flex flex-col px-4 pt-3.5",
        open ? "pb-1" : "pb-3.5",
        className,
      )}
      data-slot="missions-card"
    >
      <div className="flex items-start gap-3">
        {/* Hangs 4px out each side, so it centers on the rows' marks and the title starts with their names. */}
        {showBuddy && <BuddyFace buddy={buddy} className="-mx-1 mt-0.5 size-6" />}

        <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1 items-start gap-y-1")}>
          <MissionsHeading
            fold={
              foldRows ? { listId, onToggle: () => setUnfolded((value) => !value), open } : null
            }
            missions={missions}
            titleId={titleId}
            won={won}
          />
          <BrainPowerReward brainPower={brainPower} earned={won} points={points} />
        </div>
      </div>

      <MissionTrack className="mt-3.5" missions={missions} />

      <ListGroup className="mt-1.5" hidden={!open} id={listId}>
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
