"use client";

import {
  type PlanChapterView,
  type PlanPhaseCheckpointView,
  type PlanPhaseView,
} from "@zoonk/core/plans/view-contract";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChapterMark } from "../_components/chapter-mark";
import { LIST_GROUP_CLASS, ListRowChevronSpace } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { StatusMark } from "../_components/status-mark";
import { TRUNCATED_TITLE_CLASS } from "../_components/title-row";
import { LearnLink } from "../learn-link";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { type JourneyPathLinks } from "./journey-links";
import {
  CheckpointRow,
  MockRow,
  PATH_ROW_BODY_CLASS,
  PATH_ROW_CLASS,
  PATH_ROW_LEADING_CLASS,
  usePhaseMocksLine,
} from "./journey-phase-events";
import { useRoadmapFinish } from "./use-roadmap";

const TITLE_ID = "next-on-path-title";

function findNextChapter(phases: readonly PlanPhaseView[]): PlanChapterView | null {
  return (
    phases.flatMap((phase) => phase.chapters).find((chapter) => chapter.state === "current") ?? null
  );
}

function findNextEvents(phases: readonly PlanPhaseView[]): {
  checkpoint: PlanPhaseCheckpointView | null;
  mockDate: string | null;
} {
  const ahead = phases.filter(
    (phase) =>
      phase.kind !== "afterExam" && (phase.state === "current" || phase.state === "upcoming"),
  );

  return {
    checkpoint:
      ahead
        .map((phase) => phase.checkpoint)
        .find((checkpoint) => checkpoint?.state === "upcoming") ?? null,
    mockDate: ahead.map((phase) => phase.mocks.nextDate).find((date) => date !== null) ?? null,
  };
}

function NextChapterRow({
  chapter,
  links,
}: {
  chapter: PlanChapterView & { chapterId: string };
  links: JourneyPathLinks;
}) {
  return (
    <LearnLink
      className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")}
      href={links.chapter(chapter.chapterId)}
    >
      <span className={PATH_ROW_LEADING_CLASS}>
        <ChapterMark chapter={chapter} isNext />
      </span>
      <span className={PATH_ROW_BODY_CLASS}>
        <span className="line-clamp-2 font-medium text-pretty">{chapter.title}</span>
      </span>
      <RowChevron />
    </LearnLink>
  );
}

function FinishRow({ examHref }: { examHref: string | null }) {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const finish = useRoadmapFinish();

  const content = (
    <>
      <span className={PATH_ROW_LEADING_CLASS}>
        <FlagIcon aria-hidden="true" className="size-4" />
      </span>
      <span className={PATH_ROW_BODY_CLASS}>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{goal.displayName}</span>
          {!finish && goal.kind === "exam" && (
            <span className="text-muted-foreground text-xs">{t("Date to be confirmed")}</span>
          )}
        </span>
        {finish && (
          <PlanDateText
            className="text-muted-foreground text-xs"
            estimate={finish.estimate}
            isoDate={finish.isoDate}
            month={finish.month}
          />
        )}
      </span>
    </>
  );

  if (!examHref) {
    return (
      <div className={PATH_ROW_CLASS}>
        {content}
        <ListRowChevronSpace />
      </div>
    );
  }

  return (
    <LearnLink className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")} href={examHref}>
      {content}
      <RowChevron />
    </LearnLink>
  );
}

function AfterExamRow({ phase }: { phase: PlanPhaseView }) {
  const phaseName = usePhaseName();
  const mocksLine = usePhaseMocksLine();
  const { plan } = usePlanScreen();

  return (
    <div className={PATH_ROW_CLASS}>
      <span className={PATH_ROW_LEADING_CLASS}>
        <StatusMark status="todo" />
      </span>
      <span className={PATH_ROW_BODY_CLASS}>
        <span className="flex flex-col">
          <span className={cn(TRUNCATED_TITLE_CLASS, "font-medium")}>{phaseName(phase)}</span>
          {phase.mocks.count > 0 && (
            <span className="text-muted-foreground text-xs">
              {mocksLine({
                count: phase.mocks.count,
                forNextSitting: true,
                nextSitting: plan.schedule.nextSitting,
              })}
            </span>
          )}
        </span>
        {phase.endDate && (
          <PlanDateText
            className="text-muted-foreground text-xs"
            estimate
            isoDate={phase.endDate}
            month
          />
        )}
      </span>
    </div>
  );
}

export function NextOnPath({ className, links }: { className?: string; links: JourneyPathLinks }) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const { checkpoint, mockDate } = findNextEvents(plan.phases);
  const chapter = goal.kind === "exam" ? null : findNextChapter(plan.phases);
  const afterExam = plan.phases.filter((phase) => phase.kind === "afterExam");
  const hasNext = Boolean(mockDate || chapter?.chapterId || checkpoint) || afterExam.length > 0;

  // A challenge in the next session comes before the next phase's lessons, as on Today.
  const challengeFirst =
    checkpoint?.when === "nextSession" &&
    plan.phases.findIndex((phase) => phase.checkpoint === checkpoint) <
      plan.phases.findIndex((phase) => chapter !== null && phase.chapters.includes(chapter));

  const chapterRow = chapter?.chapterId && (
    <li>
      <NextChapterRow chapter={{ ...chapter, chapterId: chapter.chapterId }} links={links} />
    </li>
  );

  const checkpointRow = checkpoint && (
    <li>
      <CheckpointRow checkpoint={checkpoint} links={links} />
    </li>
  );

  if (!hasNext && goal.kind !== "exam") {
    return null;
  }

  return (
    <PageSection aria-labelledby={TITLE_ID} className={className} data-slot="next-on-path">
      <PageSectionHeader>
        <PageSectionTitle id={TITLE_ID}>{t("Next on your path")}</PageSectionTitle>
      </PageSectionHeader>

      <ul className={LIST_GROUP_CLASS}>
        {mockDate && (
          <li>
            <MockRow challengeHref={links.challenge} date={mockDate} examHref={links.exam} />
          </li>
        )}

        {challengeFirst ? checkpointRow : chapterRow}
        {challengeFirst ? chapterRow : checkpointRow}

        <li>
          <FinishRow examHref={links.exam} />
        </li>

        {afterExam.map((phase) => (
          <li key={phase.index}>
            <AfterExamRow phase={phase} />
          </li>
        ))}
      </ul>
    </PageSection>
  );
}
