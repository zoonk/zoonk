"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, UtensilsIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { KindTile, type LearnKind } from "../_components/kind-tile";
import { SectionLabel } from "../_components/section-label";
import { type BuddyMission, type BuddyToday } from "./buddy-status-view";

/** Each mission wears the color of what it asks for: a review, a new lesson, a mistake. */
const MISSION_KIND: Record<BuddyMission["kind"], LearnKind> = {
  fixMistake: "mistakes",
  review: "review",
  somethingNew: "lesson",
};

/** A mission with nothing to do today still counts toward the full meal. */
export function isMissionComplete(mission: BuddyMission): boolean {
  return mission.status !== "todo";
}

/** "Review", "Something new", "Fix a mistake": the three missions by name. */
function useMissionName() {
  const t = useExtracted();

  return (kind: BuddyMission["kind"]): string => {
    switch (kind) {
      case "review":
        return t("Review");
      case "somethingNew":
        return t("Something new");
      case "fixMistake":
        return t("Fix a mistake");
      default:
        return t("Review");
    }
  };
}

/**
 * What a mission still asks today, or that there was nothing to do, which still counts. A mission
 * done says nothing more: its check does.
 */
function MissionDetail({ mission }: { mission: BuddyMission }) {
  const t = useExtracted();

  if (mission.status === "done") {
    return null;
  }

  const todo: Record<BuddyMission["kind"], string> = {
    fixMistake: t("From your mistakes notebook"),
    review: t("{done} of {total} reviews", {
      done: String(mission.done),
      total: String(mission.total),
    }),
    somethingNew: t("Finish today's new lesson"),
  };

  return (
    <span className="text-muted-foreground text-sm">
      {mission.status === "nothingToday"
        ? t("Nothing due today. It still counts.")
        : todo[mission.kind]}
    </span>
  );
}

function MissionCheck({ mission }: { mission: BuddyMission }) {
  const t = useExtracted();
  const complete = isMissionComplete(mission);

  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        complete ? "bg-success text-background" : "border-border border-2",
      )}
    >
      {complete && <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={3} />}
      <span className="sr-only">{complete ? t("Done") : t("To do")}</span>
    </span>
  );
}

function MissionRow({ mission }: { mission: BuddyMission }) {
  const missionName = useMissionName();

  return (
    <li className="flex items-center gap-3">
      <KindTile kind={MISSION_KIND[mission.kind]} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{missionName(mission.kind)}</span>
        <MissionDetail mission={mission} />
      </span>
      <MissionCheck mission={mission} />
    </li>
  );
}

/** The full meal the three missions make together, or the line saying it's done. */
function FullMealLine({ today }: { today: BuddyToday }) {
  const t = useExtracted();
  const points = String(today.fullMeal.bonus);

  return (
    <p
      className={cn(
        "flex items-center gap-2 text-sm",
        today.fullMeal.earned ? "text-success font-medium" : "text-muted-foreground",
      )}
    >
      <UtensilsIcon aria-hidden="true" className="size-4 shrink-0" />
      {today.fullMeal.earned
        ? t("Full meal! +{points} Brain Power", { points })
        : t("All three make a full meal: +{points} Brain Power.", { points })}
    </p>
  );
}

/**
 * Today's three missions, done by doing the session, and the full meal they make together, on one
 * card. Before today's session exists there's nothing to count yet, so the card says when they
 * start.
 */
export function BuddyMissions({ today }: { today: BuddyToday | null }) {
  const t = useExtracted();
  const titleId = useId();
  const complete = today?.missions.filter(isMissionComplete).length ?? 0;

  return (
    <section
      aria-labelledby={titleId}
      className="bg-card flex flex-col gap-4 rounded-3xl border p-5 shadow-xs"
    >
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel id={titleId}>{t("Today's missions")}</SectionLabel>
        {today && (
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {t("{complete} of {total}", {
              complete: String(complete),
              total: String(today.missions.length),
            })}
          </span>
        )}
      </div>

      {today ? (
        <>
          <ul className="flex flex-col gap-3">
            {today.missions.map((mission) => (
              <MissionRow key={mission.kind} mission={mission} />
            ))}
          </ul>

          <FullMealLine today={today} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("Today's missions start with today's session.")}
        </p>
      )}
    </section>
  );
}
