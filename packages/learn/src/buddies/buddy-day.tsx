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

/**
 * Where the buddy's day leads: Energy over time, what the buddy remembers and the week's summary.
 * Statistics open from the account menu and the level in the top bar.
 */
export type BuddyDayHrefs = { energy: string; logbook: string; memory: string };

/** "2/6": the glasses earned of all of them, in the mono face; screen readers hear "2 of 6". */
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

/**
 * The buddy itself, under its name: how it grows, what it remembers, its glasses and the week's
 * summary, including while the learner uses the default buddy.
 */
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

/**
 * The buddy's day beside the conversation on a wide screen, where there's room to keep it in
 * sight instead of a tap away: Energy, today's missions and a new learner's first steps, then the
 * buddy (how it grows, what it remembers, its glasses, the week's summary).
 */
export function BuddyDay({
  buddy,
  hrefs,
  memoryCount,
  missionLinks,
  name,
  onGlasses,
  status,
}: {
  /** The buddy as drawn, whose face marks a question to it. */
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
      {/* Its label on the aside's first line, level with the buddy's name beside it. */}
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

/**
 * The buddy's day while the tab loads, in `BuddyDay`'s shape: Energy and today's missions under
 * their own labels, and the buddy's block; the numbers and the buddy's name wait as bars.
 */
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
