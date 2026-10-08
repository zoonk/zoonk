"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, MinusIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { KindTile, kindTextClass } from "../_components/kind-tile";
import {
  LIST_ROW_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { Surface } from "../_components/surface";
import { TestOutStartLink } from "../_components/test-out-start-link";
import { getBlockKind } from "../session/block-kind";
import { type StudyBlock } from "../session/session-types";
import { useBlockDetail, useBlockTitle } from "../session/use-block-copy";
import { CatchUpLater, useIsCatchingUp } from "./today-catch-up";
import { useTodayScreen } from "./today-context";
import { ContinueButton } from "./today-continue-button";
import { TodayDayDone } from "./today-day-done";
import { NEXT_TITLE_ID } from "./today-ids";
import { TodayLessonsWaiting } from "./today-lessons-waiting";
import { useLessonBeingWritten, useSessionState } from "./use-today-copy";

const SESSION_LIST_ID = "today-session-list";
const SESSION_TITLE_ID = "today-session-title";

/** Blocks after the next one in sight before "See all". */
const SHOWN_AFTER_NEXT = 3;

/**
 * How many parts the day holds, as the learner reads them: lessons when every one is a lesson,
 * otherwise activities, so a day of practice never reads "1 lesson". A day still waiting for
 * lessons being outlined says more are on the way, so the count growing when they land is no
 * surprise.
 */
function useDayCount(blocks: readonly StudyBlock[]) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const count = blocks.length;
  const lessonsOnly = blocks.every((block) => block.kind === "learn");

  const total = () => {
    if (today.session.lessonsComing) {
      return lessonsOnly
        ? t("{count, plural, one {# lesson} other {# lessons}} · more on the way", { count })
        : t("{count, plural, one {# activity} other {# activities}} · more on the way", { count });
    }

    return lessonsOnly
      ? t("{count, plural, one {# lesson} other {# lessons}}", { count })
      : t("{count, plural, one {# activity} other {# activities}}", { count });
  };

  return {
    see: lessonsOnly
      ? t("See today's {count, plural, one {# lesson} other {# lessons}}", { count })
      : t("See today's {count, plural, one {# activity} other {# activities}}", { count }),
    total: total(),
  };
}

function isFinished(block: StudyBlock): boolean {
  return block.status === "completed" || block.status === "skipped";
}

/** "4 min". */
function useMinutes() {
  const t = useExtracted();
  return (minutes: number) => t("{minutes} min", { minutes: String(minutes) });
}

/** The subjects the day studies, in the order it gets to them; empty when blocks have none. */
function getDaySubjects(blocks: readonly StudyBlock[]): string[] {
  return [...new Set(blocks.flatMap((block) => (block.subject ? [block.subject] : [])))];
}

/** The day's subjects in one line ("Língua Portuguesa, Direito Constitucional e Língua Inglesa"). */
function DaySubjects() {
  const format = useFormatter();
  const { today } = useTodayScreen();
  const subjects = getDaySubjects(today.session.blocks);

  if (subjects.length === 0) {
    return null;
  }

  return (
    <span
      className="text-muted-foreground block truncate text-[0.8125rem] font-normal"
      data-slot="today-subjects"
    >
      {format.list(subjects, { type: "conjunction" })}
    </span>
  );
}

/**
 * What the next block holds in a few words. A lesson being written says so instead: it opens with
 * its progress, and Today updates once it's written.
 */
function useBlockLine() {
  const t = useExtracted();
  const detail = useBlockDetail();
  const isBeingWritten = useLessonBeingWritten();

  return (block: StudyBlock): string | null =>
    isBeingWritten(block) ? t("Being written for you…") : detail(block);
}

/**
 * The one block to do now, as the card's anchor: its kind's tile, its name big, how long it takes
 * and what it holds. A lesson can be skipped with its chapter's test, one quiet line under it.
 */
function NextBlock({ block }: { block: StudyBlock }) {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const isCatchingUp = useIsCatchingUp();
  const title = useBlockTitle();
  const line = useBlockLine();
  const formatMinutes = useMinutes();
  const detail = line(block);
  const kind = getBlockKind(block);

  return (
    <div
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 flex items-start gap-4 duration-300"
      data-slot="today-next"
    >
      <KindTile kind={kind} size="lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex min-w-0 items-baseline gap-1.5 text-[0.8125rem] font-semibold tracking-wide uppercase">
          <span className={cn("shrink-0", kindTextClass(kind))}>
            {isCatchingUp(block) ? t("Catching up") : t("Up next")}
          </span>
          <span
            className={cn(
              "shrink-0 tabular-nums before:mr-1.5 before:content-['·']",
              kindTextClass(kind),
            )}
          >
            {formatMinutes(block.estimatedMinutes)}
          </span>
          {block.subject && (
            <span className="text-muted-foreground truncate font-medium normal-case before:mr-1.5 before:content-['·']">
              {block.subject}
            </span>
          )}
        </p>

        <h3
          className="text-xl leading-snug font-bold tracking-tight text-balance"
          id={NEXT_TITLE_ID}
        >
          {title(block)}
        </h3>

        {detail && <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{detail}</p>}

        {block.kind === "learn" && block.chapterId && (
          <TestOutStartLink onStart={() => actions.startTestOut(block.chapterId ?? "")} />
        )}
      </div>
    </div>
  );
}

/**
 * A block in the whole day's list: done ones checked, skipped ones dashed, the rest by kind. A done
 * block's tile is neutral, so its check never reads as practice, whose tile is green.
 */
function BlockMark({ block }: { block: StudyBlock }) {
  if (block.status === "completed") {
    return (
      <span
        aria-hidden="true"
        className="bg-muted text-success flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <CheckIcon className="size-4" strokeWidth={2.5} />
      </span>
    );
  }

  if (block.status === "skipped") {
    return (
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <MinusIcon className="size-4" />
      </span>
    );
  }

  return <KindTile kind={getBlockKind(block)} size="sm" />;
}

/** "Catching up · Língua Portuguesa": what a row in the day's list is part of. */
function useRowLabel() {
  const t = useExtracted();
  const isCatchingUp = useIsCatchingUp();

  return (block: StudyBlock): string | null => {
    if (!isCatchingUp(block)) {
      return block.subject;
    }

    return block.subject
      ? t("Catching up · {subject}", { subject: block.subject })
      : t("Catching up");
  };
}

function BlockRow({ block, isNext }: { block: StudyBlock; isNext: boolean }) {
  const t = useExtracted();
  const title = useBlockTitle();
  const formatMinutes = useMinutes();
  const isBeingWritten = useLessonBeingWritten();
  const rowLabel = useRowLabel();
  const finished = isFinished(block);
  const label = rowLabel(block);

  return (
    <li aria-current={isNext ? "step" : undefined} className={cn(LIST_ROW_CLASS, "sm:px-6")}>
      <ListRowLeading>
        <BlockMark block={block} />
      </ListRowLeading>

      <ListRowContent className="min-h-13 py-2.5">
        <ListRowTitle className={cn(finished && "text-muted-foreground")}>
          {title(block)}
          {block.status === "completed" && <span className="sr-only">{t(", done")}</span>}
          {block.status === "skipped" && <span className="sr-only">{t(", skipped")}</span>}
        </ListRowTitle>

        {!finished && isBeingWritten(block) ? (
          <ListRowDescription>{t("Being written for you…")}</ListRowDescription>
        ) : (
          label && <ListRowDescription className="truncate">{label}</ListRowDescription>
        )}
      </ListRowContent>

      <ListRowTrailing>{formatMinutes(block.estimatedMinutes)}</ListRowTrailing>
    </li>
  );
}

/**
 * The rest of the day in sight under the button: the next few blocks after this one, each with its
 * subject and minutes, and "See today's 7 activities" with the day's subjects under it for the whole
 * day in place, done ones included.
 */
function SessionList({ next }: { next: StudyBlock }) {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks } = today.session;
  const dayCount = useDayCount(blocks);
  const [open, setOpen] = useState(false);

  const upcoming = blocks
    .slice(blocks.indexOf(next) + 1)
    .filter((block) => !isFinished(block))
    .slice(0, SHOWN_AFTER_NEXT);

  const shown = open ? blocks : upcoming;
  const hasMore = blocks.length - 1 > upcoming.length;

  if (blocks.length <= 1) {
    return null;
  }

  return (
    <div className="-mx-5 -mb-5 border-t sm:-mx-6 sm:-mb-6" data-slot="today-session-list">
      <ol className="motion-safe:animate-in motion-safe:fade-in flex flex-col" id={SESSION_LIST_ID}>
        {shown.map((block) => (
          <BlockRow block={block} isNext={open && block.id === next.id} key={block.id} />
        ))}
      </ol>

      {hasMore && (
        <button
          aria-controls={SESSION_LIST_ID}
          aria-expanded={open}
          className="hover:bg-muted/50 focus-visible:ring-ring/50 flex min-h-12 w-full items-center justify-between gap-3 border-t px-5 text-left text-[0.9375rem] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset sm:px-6"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="flex min-w-0 flex-col gap-0.5 py-2.5">
            {open ? t("Show less") : dayCount.see}
            <DaySubjects />
          </span>
          {open ? (
            <ChevronDownIcon
              aria-hidden="true"
              className="text-muted-foreground/60 size-4 shrink-0 rotate-180"
            />
          ) : (
            <ChevronRightIcon
              aria-hidden="true"
              className="text-muted-foreground/60 size-4 shrink-0"
            />
          )}
        </button>
      )}
    </div>
  );
}

/** The day underway: the next block, one button and the rest under it. */
function SessionUnderway({ next }: { next: StudyBlock }) {
  return (
    <>
      {/* A new next block enters again, so moving on reads as a step. */}
      <NextBlock block={next} key={next.id} />
      <ContinueButton />
      <CatchUpLater />
      <SessionList next={next} />
    </>
  );
}

/** The block to go on with; null once the day's blocks are done. */
function useNextBlock(): StudyBlock | null {
  const { today } = useTodayScreen();
  const { blocks, nextBlockId } = today.session;

  return blocks.find((block) => block.id === nextBlockId) ?? null;
}

function SessionCardBody() {
  const next = useNextBlock();
  const { limitReached, waiting } = useSessionState();

  if (waiting) {
    return <TodayLessonsWaiting />;
  }

  if (!next || limitReached) {
    return <TodayDayDone />;
  }

  return <SessionUnderway next={next} />;
}

/**
 * Today's session under its header with how many lessons the day holds, as one card focused on
 * what's next: the next block with its kind's tile, one Start or Continue, and the next few blocks
 * under it with their subjects. A day without a block to start (done, a rest day, the study time
 * used up, or lessons still being prepared) says only what that means.
 */
export function TodaySessionCard() {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { blocks } = today.session;
  const dayCount = useDayCount(blocks);

  return (
    <PageSection aria-labelledby={SESSION_TITLE_ID} data-slot="today-session">
      <PageSectionHeader>
        <PageSectionTitle id={SESSION_TITLE_ID}>{t("Today's session")}</PageSectionTitle>
        {blocks.length > 0 && <PageSectionDetail>{dayCount.total}</PageSectionDetail>}
      </PageSectionHeader>

      <Surface className="flex flex-col gap-5 overflow-hidden p-5 sm:p-6">
        <SessionCardBody />
      </Surface>
    </PageSection>
  );
}
