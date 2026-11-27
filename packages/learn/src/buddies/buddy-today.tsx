"use client";

import { countDoneMissions } from "@zoonk/core/sessions/missions";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { SheetHeader } from "../_components/sheet-header";
import { useCountOf } from "../_utils/count-of";
import { useFormatShare } from "../_utils/percent";
import { LearnLink } from "../learn-link";
import { FirstStepsSection } from "../missions/first-steps";
import { type MissionLinks } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { BuddyEnergy, useGrowthLine } from "./buddy-day-parts";
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
        <SheetHeader>
          <div className="flex flex-col gap-1">
            <DrawerTitle>{t("{buddy} today", { buddy: name })}</DrawerTitle>
            <DrawerDescription>{growth}</DrawerDescription>
          </div>
        </SheetHeader>

        <DrawerContent className="flex flex-col gap-4 pt-2">
          <BuddyEnergy className="-mb-2" href={energyHref} name={name} status={status} />

          {today && today.missions.length > 0 && (
            <div className="border-t pt-5">
              <MissionsCard buddy={buddy} links={links} today={today} />
            </div>
          )}

          {firstSteps && (
            <div className="border-t pt-5">
              <FirstStepsSection buddy={buddy} firstSteps={firstSteps} links={links} />
            </div>
          )}
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
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
  const countOf = useCountOf();
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const { current } = status.energy;
  const today = status.today;
  const done = today ? countDoneMissions(today.missions) : 0;

  const total = today?.missions.length ?? 0;

  return (
    <>
      <div
        // Its links' padding hangs past the row, so their words start where the name's do.
        className={cn("-mx-2 flex flex-wrap items-center gap-x-2.5 gap-y-1", className)}
        data-slot="buddy-today"
      >
        <LearnLink
          href={energyHref}
          className="hit-area text-muted-foreground hover:text-foreground relative flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-xs tabular-nums"
        >
          <ZapIcon aria-hidden="true" className="text-energy size-3.5" />
          <span>{t("{buddy}'s Energy", { buddy: name })}</span>
          {current === null ? <NotYet /> : formatShare(current / PERCENT)}
        </LearnLink>
        <button
          aria-haspopup="dialog"
          className="hit-area text-muted-foreground hover:text-foreground held-pressed:bg-muted held-pressed:text-foreground relative flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 text-xs tabular-nums"
          onClick={() => {
            setAsked(false);
            setOpen(true);
          }}
          type="button"
        >
          {total > 0 ? (
            <>
              <MissionsRing
                className="size-3.5"
                missions={{ done, total }}
                moment={false}
                strokeWidth={6}
              />
              <span>{t("Today's missions")}</span>
              <span>{countOf(done, total)}</span>
            </>
          ) : (
            <span>{t("{buddy} today", { buddy: name })}</span>
          )}
        </button>
      </div>

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
