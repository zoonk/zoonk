"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronRightIcon, XIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { Meter, MeterFill } from "../_components/meter";
import { SURFACE_CLASS } from "../_components/surface";
import { useFormatShare } from "../_utils/percent";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { LearnLink } from "../learn-link";
import { BuddyStageName } from "./buddy-labels";
import { BuddyMissions, isMissionComplete } from "./buddy-missions";
import { type BuddyStatusView } from "./buddy-status-view";
import { MissionsRing } from "./missions-ring";

const PERCENT = 100;

/** "Grows to Young at Orange belt": the next stage and the belt that brings it. */
function useGrowthLine(status: BuddyStatusView): string {
  const t = useExtracted();
  const beltName = useBeltName();
  const next = status.nextStage;
  const nextBelt = next ? toBeltColor(next.belt) : null;

  if (!(next && nextBelt)) {
    return t("Fully grown");
  }

  const belt = beltName(nextBelt);

  const stages: Record<typeof next.stage, string> = {
    adult: t("Grows to Adult at {belt}", { belt }),
    baby: t("Grows to Young at {belt}", { belt }),
    wise: t("Grows to Wise at {belt}", { belt }),
    young: t("Grows to Young at {belt}", { belt }),
  };

  return stages[next.stage];
}

/** One line on how Energy moves today: napping, studied already, or not yet. */
function useEnergyLine({ name, status }: { name: string; status: BuddyStatusView }) {
  const t = useExtracted();

  if (status.energy.state === "napping") {
    return t("{buddy} took a nap. Anything you learn wakes it up.", { buddy: name });
  }

  return status.energy.studiedToday
    ? t("You studied today, so Energy won't drop.")
    : t("Studying today keeps Energy up.");
}

const ENERGY_CARD_CLASS = "bg-card flex flex-col gap-3 rounded-3xl border p-5 shadow-xs";

function EnergyTile() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
    >
      <ZapIcon className="size-4" />
    </span>
  );
}

/**
 * Before a day of study has passed, Energy has nothing to say yet: no empty meter, just when it
 * starts.
 */
function EnergyStarts() {
  const t = useExtracted();

  return (
    <div className={ENERGY_CARD_CLASS}>
      <span className="flex items-center gap-3">
        <EnergyTile />
        <span className="flex-1 font-semibold">{t("Energy")}</span>
      </span>

      <span className="text-muted-foreground text-sm">
        {t("Energy starts after your first day of study, and grows as you learn.")}
      </span>
    </div>
  );
}

/** Energy is the buddy's: the share, a bar and one line, opening its history. */
function BuddyEnergy({
  href,
  name,
  status,
}: {
  href: string;
  name: string;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const line = useEnergyLine({ name, status });

  if (status.energy.current === null) {
    return <EnergyStarts />;
  }

  const share = status.energy.current / PERCENT;

  return (
    <LearnLink
      className={cn(
        ENERGY_CARD_CLASS,
        "hover:bg-muted/40 focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-[3px]",
      )}
      href={href}
    >
      <span className="flex items-center gap-3">
        <EnergyTile />
        <span className="flex-1 font-semibold">{t("Energy")}</span>
        <span className="text-energy text-2xl font-bold tabular-nums">{formatShare(share)}</span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </span>

      <Meter className="h-2.5">
        <MeterFill className="bg-energy" share={share} />
      </Meter>

      <span className="text-muted-foreground text-sm">{line}</span>
    </LearnLink>
  );
}

/** The buddy's day in a sheet: Energy with its history, the missions, how the buddy grows. */
function BuddyTodaySheet({
  energyHref,
  hasBuddy,
  name,
  onOpenChange,
  open,
  status,
}: {
  energyHref: string;
  hasBuddy: boolean;
  name: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const growth = useGrowthLine(status);

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold">
              {hasBuddy ? t("{buddy} today", { buddy: name }) : t("Your day")}
            </DrawerTitle>
            {hasBuddy && (
              <DrawerDescription>
                <BuddyStageName stage={status.stage} />
                {" · "}
                {growth}
              </DrawerDescription>
            )}
          </div>
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-4 pt-2">
          <BuddyEnergy href={energyHref} name={name} status={status} />
          <BuddyMissions today={status.today} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

/** "0 of 3": today's missions done, or nothing before the day has missions. */
function useMissionsValue(status: BuddyStatusView): string {
  const t = useExtracted();
  const today = status.today;

  if (!today) {
    return t("Not yet");
  }

  const done = today.missions.filter((mission) => mission.status !== "todo").length;

  return t("{done, number} of {total, number}", { done, total: today.missions.length });
}

/** "1 of 3 missions": the missions tile's name for screen readers. */
function useMissionsLabel(status: BuddyStatusView): string {
  const t = useExtracted();
  const today = status.today;

  if (!today) {
    return t("Missions");
  }

  const done = today.missions.filter((mission) => mission.status !== "todo").length;

  return t("{done} of {total} missions", {
    done: String(done),
    total: String(today.missions.length),
  });
}

const STAT_TILE_CLASS = cn(
  SURFACE_CLASS,
  "hover:bg-muted/40 focus-visible:ring-ring/50 flex min-w-0 items-center gap-3 p-3 text-left transition-colors outline-none focus-visible:ring-[3px]",
);

/**
 * The buddy's day under its name, as two small stat tiles: its Energy, opening the Energy page with
 * its history, and today's missions, opening the day in a sheet (the missions, Energy, how the buddy
 * grows).
 */
export function BuddyToday({
  energyHref,
  hasBuddy,
  name,
  status,
}: {
  energyHref: string;
  /** Before a buddy is picked, the sheet is the learner's day, without a buddy to grow. */
  hasBuddy: boolean;
  name: string;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const missions = useMissionsValue(status);
  const missionsLabel = useMissionsLabel(status);
  const [open, setOpen] = useState(false);
  const { current } = status.energy;
  const energy = current === null ? null : formatShare(current / PERCENT);

  return (
    <>
      <div className="grid grid-cols-2 gap-3" data-slot="buddy-today">
        <LearnLink
          aria-label={energy === null ? t("Energy") : t("Energy {energy}", { energy })}
          className={STAT_TILE_CLASS}
          href={energyHref}
        >
          <EnergyTile />
          <span className="flex min-w-0 flex-col">
            <span className="text-muted-foreground text-xs font-medium">{t("Energy")}</span>
            <span
              className={cn(
                "truncate text-lg leading-tight font-bold tabular-nums",
                energy !== null && "text-energy",
              )}
            >
              {energy ?? t("Not yet")}
            </span>
          </span>
        </LearnLink>

        <button
          aria-haspopup="dialog"
          aria-label={missionsLabel}
          className={STAT_TILE_CLASS}
          onClick={() => setOpen(true)}
          type="button"
        >
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
          >
            {status.today ? (
              <MissionsRing
                className="size-5"
                missions={{
                  done: status.today.missions.filter(isMissionComplete).length,
                  total: status.today.missions.length,
                }}
                moment={false}
                strokeWidth={5}
              />
            ) : (
              <CheckIcon className="size-4" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-muted-foreground truncate text-xs font-medium">
              {t("Today's missions")}
            </span>
            <span className="truncate text-lg leading-tight font-bold tabular-nums">
              {missions}
            </span>
          </span>
        </button>
      </div>

      <BuddyTodaySheet
        energyHref={energyHref}
        hasBuddy={hasBuddy}
        name={name}
        onOpenChange={setOpen}
        open={open}
        status={status}
      />
    </>
  );
}
