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
import { MissionListRow, useMissionsDoneCount } from "./mission-list";
import { MissionMark } from "./mission-mark";
import { MissionTrack } from "./mission-track";

export type MissionsDay = Pick<BuddyToday, "fullMeal"> & { missions: readonly MissionView[] };

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
    <>
      <span className="hidden sm:inline">{title}</span>
      <button
        aria-controls={fold.listId}
        aria-expanded={fold.open}
        className="hit-area focus-visible:ring-ring/50 relative rounded-sm text-left outline-none focus-visible:ring-[3px] sm:hidden"
        onClick={fold.onToggle}
        type="button"
      >
        {title}
        <FoldChevron className="text-muted-foreground ms-1 align-[-3px]" inline />
      </button>
    </>
  );
}

function MissionsLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Surface
      className={cn(TITLE_ROW_CLASS, "min-h-14 gap-y-1 p-4 text-sm", className)}
      data-slot="missions-card"
    >
      {children}
    </Surface>
  );
}

/**
 * One list with one look wherever it shows: every mission is a row, named by what to do, and the
 * reward says what doing them all earns. Today folds the rows behind the title (`foldRows`) on
 * phones, where most of them are already in the day's list right above the card.
 */
export function MissionsCard({
  buddy,
  className,
  collapseWhenDone = false,
  foldRows = false,
  links,
  today,
}: {
  buddy: LearnBuddy | null;
  className?: string;
  collapseWhenDone?: boolean;
  foldRows?: boolean;
  links: MissionLinks;
  today: MissionsDay | null;
}) {
  const t = useExtracted();
  const missionName = useMissionName(buddy);
  const missionsDoneCount = useMissionsDoneCount();
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
        <BrainPowerReward earned points={points} />
      </MissionsLine>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        SURFACE_CLASS,
        "flex flex-col px-4 pt-4",
        open ? "pb-1.25" : "pb-4 sm:pb-1.25",
        className,
      )}
      data-slot="missions-card"
    >
      <h2 className="text-sm leading-snug font-semibold text-balance wrap-break-word" id={titleId}>
        <MissionsTitle
          fold={foldRows ? { listId, onToggle: () => setUnfolded((value) => !value), open } : null}
          won={won}
        />
      </h2>

      <div className="mt-3 flex items-center gap-3">
        <MissionTrack
          className="flex-1"
          label={missionsDoneCount({ done: countDoneMissions(missions), total: missions.length })}
          missions={missions}
        />
        <span className="shrink-0">
          <BrainPowerReward earned={won} points={points} />
        </span>
      </div>

      <ListGroup className={cn("mt-1.5", !open && "max-sm:hidden")} id={listId}>
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
