"use client";

import { countDoneMissions } from "@zoonk/core/sessions/missions";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { useFormatShare } from "../_utils/percent";
import { FirstStepsSection } from "../missions/first-steps";
import { type MissionLinks } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { BuddyEnergy, useGrowthLine } from "./buddy-day-parts";
import { BuddyStageName } from "./buddy-labels";
import { type BuddyStatusView } from "./buddy-status-view";
import { MissionsRing } from "./missions-ring";
import { type LearnBuddy } from "./use-buddy-name";

const PERCENT = 100;

const DASH = "–";

function BuddyTodaySheet({
  asked,
  buddy,
  energyHref,
  missionLinks,
  name,
  onAsk,
  onOpenChange,
  open,
  status,
}: {
  asked: boolean;
  buddy: LearnBuddy;
  energyHref: string;
  missionLinks: MissionLinks;
  name: string;
  onAsk: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const growth = useGrowthLine(status);
  const { askBuddy } = missionLinks;
  const { firstSteps, today } = status;

  // The composer takes focus inside the tap itself, the only moment a phone raises its keyboard,
  // then the sheet closes without moving focus back to the line that opened it.
  const links: MissionLinks = askBuddy
    ? {
        ...missionLinks,
        askBuddy: () => {
          onAsk();
          askBuddy();
          onOpenChange(false);
        },
      }
    : missionLinks;

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      <DrawerPopup finalFocus={!asked}>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold">
              {t("{buddy} today", { buddy: name })}
            </DrawerTitle>
            <DrawerDescription>
              <BuddyStageName stage={status.stage} />
              {" · "}
              {growth}
            </DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-4 pt-2">
          <BuddyEnergy href={energyHref} name={name} status={status} />

          {(!today || today.missions.length > 0) && (
            <div className="border-t pt-4">
              <MissionsCard
                brainPower={status.belt.totalBrainPower}
                showBuddy={false}
                buddy={buddy}
                links={links}
                today={today}
              />
            </div>
          )}

          {firstSteps && (
            <div className="border-t pt-4">
              <FirstStepsSection buddy={buddy} firstSteps={firstSteps} links={links} />
            </div>
          )}
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

function useMissionsLabel(status: BuddyStatusView): string {
  const t = useExtracted();
  const today = status.today;

  if (!today) {
    return t("Missions");
  }

  const done = countDoneMissions(today.missions);

  return t(
    "{done, plural, =0 {# of {total} missions} one {# of {total} missions} other {# of {total} missions}}",
    { done, total: String(today.missions.length) },
  );
}

function NotYet() {
  const t = useExtracted();

  return (
    <>
      <span aria-hidden="true" className="text-faint">
        {DASH}
      </span>
      <span className="sr-only">{t("Not yet")}</span>
    </>
  );
}

export function BuddyToday({
  buddy,
  className,
  energyHref,
  missionLinks,
  name,
  status,
}: {
  buddy: LearnBuddy;
  className?: string;
  energyHref: string;
  missionLinks: MissionLinks;
  name: string;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const missionsLabel = useMissionsLabel(status);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const { current } = status.energy;
  const today = status.today;
  const done = today ? countDoneMissions(today.missions) : 0;

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={cn(
          "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 hit-area relative flex h-7 shrink-0 items-center gap-2.5 rounded-md px-2 font-mono text-xs tabular-nums transition-colors outline-none focus-visible:ring-[3px]",
          className,
        )}
        data-slot="buddy-today"
        onClick={() => {
          setAsked(false);
          setOpen(true);
        }}
        type="button"
      >
        <span className="flex items-center gap-1">
          <ZapIcon aria-hidden="true" className="text-energy size-3.5" />
          <span className="sr-only">{`${t("Energy")} `}</span>
          {current === null ? <NotYet /> : formatShare(current / PERCENT)}
        </span>

        <span className={cn("flex items-center gap-1.5", today?.missions.length === 0 && "hidden")}>
          {today ? (
            <MissionsRing
              className="size-3.5"
              missions={{ done, total: today.missions.length }}
              moment={false}
              strokeWidth={6}
            />
          ) : (
            <CheckIcon aria-hidden="true" className="size-3.5" />
          )}
          <span aria-hidden="true">{today ? `${done}/${today.missions.length}` : DASH}</span>
          <span className="sr-only">{missionsLabel}</span>
        </span>
      </button>

      <BuddyTodaySheet
        asked={asked}
        buddy={buddy}
        energyHref={energyHref}
        missionLinks={missionLinks}
        name={name}
        onAsk={() => setAsked(true)}
        onOpenChange={setOpen}
        open={open}
        status={status}
      />
    </>
  );
}
