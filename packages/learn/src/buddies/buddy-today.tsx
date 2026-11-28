"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import { ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { SheetHeader } from "../_components/sheet-header";
import { useFormatShare } from "../_utils/percent";
import { FirstStepsSection } from "../missions/first-steps";
import { type MissionLinks } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { BuddyEnergy, useGrowthLine } from "./buddy-day-parts";
import { type BuddyStatusView } from "./buddy-status-view";
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

/** Its Energy beside the buddy's name; the sheet it opens holds the rest of the buddy's day. */
export function BuddyToday({
  buddy,
  energyHref,
  missionLinks,
  name,
  status,
}: {
  buddy: LearnBuddy;
  energyHref: string;
  missionLinks: MissionLinks;
  name: string;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const { current } = status.energy;

  return (
    <>
      <button
        aria-haspopup="dialog"
        // Right after the name, as its own reading: its padding hangs into the name's gap, and the
        // free room goes after it instead of between them.
        className="hit-area text-muted-foreground hover:text-foreground held-pressed:bg-muted held-pressed:text-foreground relative -ms-2 me-auto flex min-h-7 items-center gap-1 rounded-md px-2 py-1 text-xs tabular-nums"
        data-slot="buddy-today"
        onClick={() => {
          setAsked(false);
          setOpen(true);
        }}
        type="button"
      >
        <ZapIcon aria-hidden="true" className="text-energy size-3.5" />
        <span className="sr-only">{t("{buddy}'s Energy", { buddy: name })}</span>
        {current === null ? <NotYet /> : formatShare(current / PERCENT)}
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
