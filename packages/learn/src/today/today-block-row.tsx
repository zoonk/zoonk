"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { TargetIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { KindMark } from "../_components/kind-tile";
import { PlusMark } from "../_components/plus-lock";
import { TestOutStartLink } from "../_components/test-out-start-link";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { type MissionView } from "../missions/mission-links";
import { BlockMark } from "../session/block-mark";
import { type DayStep } from "../session/session-types";
import { getChallengePhase, useBlockDetail, useBlockTitle } from "../session/use-block-copy";
import { useIsCatchingUp } from "./today-catch-up";
import { useTodayScreen } from "./today-context";
import { NEXT_TITLE_ID } from "./today-ids";
import { isFinished } from "./today-queue";
import { useLessonBeingWritten } from "./use-today-copy";

/** Where a row sits in the day: its fold on a phone or on a long day. */
export type RowFold = { hidden: boolean; phone: boolean; wide: boolean };

const NO_FOLD: RowFold = { hidden: false, phone: false, wide: false };

/**
 * A row's name when it opens its block: its `::after` stretches over the whole row (44px tall at
 * least, as wide as the row's highlight), so the row is one target, with its focus ring there.
 */
const ROW_OPEN_CLASS =
  "flex min-w-0 text-left outline-none after:absolute after:top-1/2 after:h-full after:min-h-11 after:-translate-y-1/2 after:rounded-[0.625rem] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 disabled:cursor-default";

/**
 * "Catching up · Portuguese Language": what a row in the day's list is part of; a phase's challenge
 * names its phase (see `getChallengePhase`). A topic the exam asks a lot says so.
 */
function useRowLabel() {
  const t = useExtracted();
  const isCatchingUp = useIsCatchingUp();

  const part = (block: DayStep): string | null => {
    if (!isCatchingUp(block)) {
      return block.subject ?? getChallengePhase(block);
    }

    return block.subject
      ? t("Catching up · {subject}", { subject: block.subject })
      : t("Catching up");
  };

  return (block: DayStep): string | null => {
    const label = part(block);

    if (!block.oftenTested) {
      return label;
    }

    return label ? t("{label} · often tested", { label }) : t("Often tested");
  };
}

/**
 * Why a phase's challenge can't be opened yet, where its label goes: it waits for the day's
 * lessons before it, or for the challenge before it (`getBlockWait`).
 */
function useWaitLabel() {
  const t = useExtracted();

  return (block: DayStep, wait: "challenge" | "lessons"): string => {
    const phase = getChallengePhase(block);

    if (wait === "lessons") {
      return phase ? t("{phase} · after today's lessons", { phase }) : t("After today's lessons");
    }

    return phase
      ? t("{phase} · after the challenge before it", { phase })
      : t("After the challenge before it");
  };
}

/**
 * A row's frame: a hairline under it (none above the next block's highlight), one line when it's
 * done, the next block highlighted a little past the column's edges with its words from the top,
 * and hidden while its fold is closed. A row that opens its block is highlighted the same way under
 * the pointer, and fades while its block opens.
 */
function getRowClass({
  finished,
  fold,
  isNext,
}: {
  finished: boolean;
  fold: RowFold;
  isNext: boolean;
}): string {
  return cn(
    "relative isolate flex items-center gap-3 border-b transition-opacity last:border-b-0 has-aria-busy:opacity-60 has-[+[aria-current=step]]:border-b-0",
    "has-[[data-slot=today-row-open]:hover]:before:bg-muted/70 before:pointer-events-none before:absolute before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem] before:transition-colors",
    finished ? "py-[9px]" : "py-2.75",
    isNext
      ? "bg-muted -mx-2.5 my-0.5 items-start rounded-[0.625rem] border-b-0 px-2.5 before:inset-x-0"
      : "before:-inset-x-2.5",
    fold.hidden && fold.phone && "max-sm:hidden",
    fold.hidden && fold.wide && "hidden",
  );
}

/** A row's name as the button that opens its block, wherever it is in the day's order. */
function RowOpen({
  block,
  children,
  countsTowardMission,
  isNext,
}: {
  block: DayStep;
  children: React.ReactNode;
  countsTowardMission: boolean;
  isNext: boolean;
}) {
  const { actions } = useTodayScreen();
  const t = useExtracted();
  const title = useBlockTitle();
  const [pending, startTransition] = useTransition();

  const open = () => {
    startTransition(async () => {
      await actions.openBlock(block);
    });
  };

  return (
    <button
      aria-busy={pending || undefined}
      aria-label={`${title(block)}${countsTowardMission ? t(", counts toward a mission") : ""}`}
      className={cn(ROW_OPEN_CLASS, isNext ? "after:inset-x-0" : "after:-inset-x-2.5")}
      data-slot="today-row-open"
      disabled={pending}
      onClick={open}
      type="button"
    >
      {children}
    </button>
  );
}

/** A row's name, muted once finished, with its state for screen readers. */
function RowName({ block, isNext }: { block: DayStep; isNext: boolean }) {
  const t = useExtracted();
  const title = useBlockTitle();

  return (
    <span
      className={cn(
        "truncate text-sm leading-5 font-medium",
        isFinished(block) && "text-muted-foreground",
      )}
      id={isNext ? NEXT_TITLE_ID : undefined}
    >
      {title(block)}
      {block.status === "completed" && <span className="sr-only">{t(", done")}</span>}
      {block.status === "skipped" && <span className="sr-only">{t(", skipped")}</span>}
    </span>
  );
}

/**
 * What a row still to do says under its name: what it's part of (or what its challenge waits
 * for), a review's detail, and the next lesson's chapter test, a link of its own above the row's.
 */
function RowLines({
  block,
  isNext,
  wait,
}: {
  block: DayStep;
  isNext: boolean;
  wait: "challenge" | "lessons" | null;
}) {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const detail = useBlockDetail();
  const isBeingWritten = useLessonBeingWritten();
  const rowLabel = useRowLabel();
  const waitLabel = useWaitLabel();
  const reviewDetail = block.weakest || block.fullReview ? detail(block) : null;

  const label = isBeingWritten(block) ? t("Being written for you…") : rowLabel(block);
  const line = wait ? waitLabel(block, wait) : label;

  return (
    <>
      {line && <span className="text-muted-foreground truncate text-xs leading-4">{line}</span>}

      {reviewDetail && (
        <span className="text-muted-foreground text-xs leading-4">{reviewDetail}</span>
      )}

      {isNext && block.canTestOut && block.chapterId && (
        <div className="relative">
          <TestOutStartLink
            className="pt-1.5 text-xs"
            onStart={() => actions.startTestOut(block.chapterId ?? "")}
          />
        </div>
      )}
    </>
  );
}

/** Whether a mission opens this step: by its id on a saved day, by its place on a day not opened yet. */
export function opensStep(opens: MissionView["opens"], step: DayStep): boolean {
  if (opens?.kind !== "block") {
    return false;
  }

  return "blockId" in opens
    ? "id" in step && opens.blockId === step.id
    : opens.ref.position === step.position;
}

/**
 * Whether a block is one a mission still to do opens, marked in Brain Power's violet beside its
 * minutes: doing it moves the day's missions. Only the block a tap on the mission would open, so a
 * day's queue carries at most one mark per mission, and none once the mission is done, while it
 * waits, or once today's bonus is earned.
 */
export function useCountsTowardMission() {
  const { missions } = useTodayScreen();

  // Once today's bonus is earned (here or by another goal), nothing is at stake: no marks.
  return (step: DayStep): boolean =>
    Boolean(
      !missions?.fullMeal.earned &&
      missions?.missions.some(
        (mission) =>
          mission.status === "todo" && !mission.waitReason && opensStep(mission.opens, step),
      ),
    );
}

/**
 * One block in the day's queue: its mark (`BlockMark`), its name with what it's part of under it,
 * and its minutes. Any block still to do opens from its row, in whatever order the learner likes;
 * the next one is highlighted, its name is what Continue opens, and a lesson there can be skipped
 * with its chapter's test (its own link, above the row's). A phase's challenge with lessons still
 * before it says it waits for them instead of opening. A finished one is one quiet line that opens
 * nothing: the done mark (or a skipped one's ring) and its name, muted and never struck, since the
 * mark already says it, and no minutes: those were the plan's estimate, and "✓ Reviews 8 min"
 * above "2 min studied" read as time studied. A folded row hides on a phone, or on every screen
 * once a long day passes `WIDE_UPCOMING_ROWS`, until its fold opens. Once today's study time is
 * used up, no row opens (`opens`).
 */
export function BlockRow({
  block,
  fold = NO_FOLD,
  isNext,
  opens = true,
}: {
  block: DayStep;
  fold?: RowFold;
  isNext: boolean;
  opens?: boolean;
}) {
  const formatDuration = useFormatDuration();
  const finished = isFinished(block);
  const countsTowardMission = useCountsTowardMission()(block);
  const wait = block.waitReason;
  const name = <RowName block={block} isNext={isNext} />;

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={getRowClass({ finished, fold, isNext })}
      data-slot={isNext ? "today-next" : undefined}
    >
      <span className="flex h-5 w-3 shrink-0 items-center justify-center">
        <BlockMark block={block} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-px">
        {finished || wait || !opens ? (
          name
        ) : (
          <RowOpen block={block} countsTowardMission={countsTowardMission} isNext={isNext}>
            {name}
          </RowOpen>
        )}

        {!finished && <RowLines block={block} isNext={isNext} wait={wait} />}
      </div>

      {!finished && (
        <span className="text-muted-foreground flex h-5 shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
          {countsTowardMission && (
            <TargetIcon
              aria-hidden="true"
              className="text-brain size-3.5"
              data-slot="mission-row-mark"
            />
          )}
          {formatDuration(block.estimatedMinutes)}
        </span>
      )}
    </li>
  );
}

/**
 * A lesson of the plan after today's session (see `TodayUpNext`), drawn as a lesson still to do:
 * its mark, its name and its minutes. It opens nothing itself: "Keep learning" adds it, the first
 * one highlighted as where that goes on.
 */
export function PlanLessonRow({
  isNext,
  minutes,
  title,
}: {
  isNext: boolean;
  minutes: number;
  title: string;
}) {
  const formatDuration = useFormatDuration();

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={getRowClass({ finished: false, fold: NO_FOLD, isNext })}
    >
      <span className="flex h-5 w-3 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium">{title}</span>

      <span className="text-muted-foreground flex h-5 shrink-0 items-center font-mono text-xs tabular-nums">
        {formatDuration(minutes)}
      </span>
    </li>
  );
}

/**
 * One of the lessons the plan dates today that the learner's plan holds for Plus, after the day's
 * blocks: drawn as a lesson still to do, the Plus mark where its minutes would be, opening the Plus
 * page. The mark is part of the link, so its name says "Available with Plus" wherever it's read.
 * It isn't part of the session: never the next block, no mission mark, and the day's segments,
 * time and action leave it out. It folds with the day's other upcoming rows.
 */
export function PlusLessonRow({ fold = NO_FOLD, title }: { fold?: RowFold; title: string }) {
  const { actions } = useTodayScreen();

  return (
    <li
      className={cn(
        getRowClass({ finished: false, fold, isNext: false }),
        "has-[a:hover]:before:bg-muted/70",
      )}
    >
      <span className="flex h-5 w-3 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <LearnLink
        className={cn(ROW_OPEN_CLASS, "flex-1 items-center gap-3 after:-inset-x-2.5")}
        href={actions.plusHref}
      >
        <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium">{title}</span>
        <PlusMark />
      </LearnLink>
    </li>
  );
}
