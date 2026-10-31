"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { useExtracted } from "next-intl";
import { useId } from "react";
import {
  ListGroup,
  ListRow,
  ListRowButton,
  ListRowContent,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PAGE_SECTION_TITLE_CLASS, PageSectionTitle } from "../_components/page";
import { FirstStepsSection } from "../missions/first-steps";
import { type MissionLinks } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { BuddyEnergy, useGrowthLine } from "./buddy-day-parts";
import { type BuddyStatusView } from "./buddy-status-view";
import { type LearnBuddy } from "./use-buddy-name";

export type BuddyDayHrefs = { energy: string; logbook: string; memory: string };

function GlassesCount({ status }: { status: BuddyStatusView }) {
  const t = useExtracted();
  const earned = String(status.glasses.filter((item) => item.earned).length);
  const total = String(status.glasses.length);

  return (
    <>
      <span aria-hidden="true">{`${earned}/${total}`}</span>
      <span className="sr-only">{t("{earned} of {total}", { earned, total })}</span>
    </>
  );
}

function BuddyRows({
  hrefs,
  memoryCount,
  name,
  onGlasses,
  status,
}: {
  hrefs: BuddyDayHrefs;
  memoryCount?: number;
  name: string;
  onGlasses: () => void;
  status: BuddyStatusView;
}) {
  const t = useExtracted();
  const titleId = useId();
  const growth = useGrowthLine(status);

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1">
      <PageSectionTitle id={titleId}>{name}</PageSectionTitle>

      <ListGroup>
        <ListRow>
          <ListRowContent>
            <ListRowTitle>{growth}</ListRowTitle>
          </ListRowContent>
        </ListRow>

        <ListRowLink href={hrefs.memory}>
          <ListRowContent>
            <ListRowTitle>{t("What {buddy} remembers", { buddy: name })}</ListRowTitle>
          </ListRowContent>
          {memoryCount !== undefined && <ListRowTrailing>{memoryCount}</ListRowTrailing>}
        </ListRowLink>

        <ListRowButton aria-haspopup="dialog" onClick={onGlasses}>
          <ListRowContent>
            <ListRowTitle>{t("Glasses")}</ListRowTitle>
          </ListRowContent>
          <ListRowTrailing>
            <GlassesCount status={status} />
          </ListRowTrailing>
        </ListRowButton>

        <ListRowLink href={hrefs.logbook}>
          <ListRowContent>
            <ListRowTitle>{t("Weekly summary")}</ListRowTitle>
          </ListRowContent>
        </ListRowLink>
      </ListGroup>
    </section>
  );
}

export function BuddyDay({
  buddy,
  hrefs,
  memoryCount,
  missionLinks,
  name,
  onGlasses,
  status,
}: {
  buddy: LearnBuddy;
  hrefs: BuddyDayHrefs;
  memoryCount?: number;
  missionLinks: MissionLinks;
  name: string;
  onGlasses: () => void;
  status: BuddyStatusView;
}) {
  return (
    <>
      <BuddyEnergy className="-my-2" href={hrefs.energy} name={name} status={status} />
      <MissionsCard
        brainPower={status.belt.totalBrainPower}
        showBuddy={false}
        buddy={buddy}
        links={missionLinks}
        today={status.today}
      />
      <FirstStepsSection buddy={buddy} firstSteps={status.firstSteps} links={missionLinks} />
      <BuddyRows
        hrefs={hrefs}
        memoryCount={memoryCount}
        name={name}
        onGlasses={onGlasses}
        status={status}
      />
    </>
  );
}

export function BuddyDaySkeleton() {
  const t = useExtracted();

  return (
    <>
      <div className="-my-2 flex flex-col gap-2 py-2">
        <span className="flex items-center justify-between gap-3">
          <span className={PAGE_SECTION_TITLE_CLASS}>{t("Energy")}</span>
          <Skeleton className="h-3 w-8 rounded-sm" />
        </span>
        <Skeleton className="h-1.5 w-full rounded-[3px]" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex flex-col gap-3">
        <span className="flex items-baseline justify-between gap-2">
          <span className={PAGE_SECTION_TITLE_CLASS}>{t("Today's missions")}</span>
          <Skeleton className="h-3 w-6 rounded-sm" />
        </span>
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-44 w-full rounded-lg" />
      </div>
    </>
  );
}
