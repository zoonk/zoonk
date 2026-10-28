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

export type RowFold = { hidden: boolean; phone: boolean; wide: boolean };

const NO_FOLD: RowFold = { hidden: false, phone: false, wide: false };

/** Its `::after` stretches over the whole row, so the row is one target with its focus ring there. */
const ROW_OPEN_CLASS =
  "flex min-w-0 text-left outline-none after:absolute after:top-1/2 after:h-full after:min-h-11 after:-translate-y-1/2 after:rounded-[0.625rem] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 disabled:cursor-default";

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

export function opensStep(opens: MissionView["opens"], step: DayStep): boolean {
  if (opens?.kind !== "block") {
    return false;
  }

  return "blockId" in opens
    ? "id" in step && opens.blockId === step.id
    : opens.ref.position === step.position;
}

export function useCountsTowardMission() {
  const { missions } = useTodayScreen();

  return (step: DayStep): boolean =>
    Boolean(
      !missions?.fullMeal.earned &&
      missions?.missions.some(
        (mission) =>
          mission.status === "todo" && !mission.waitReason && opensStep(mission.opens, step),
      ),
    );
}

/** A finished row shows no minutes: they were the plan's estimate, and "✓ Reviews 8 min" above "2 min studied" read as time studied. */
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

export function PlanLessonRow({
  busy,
  minutes,
  onOpen,
  title,
}: {
  busy: boolean;
  minutes: number;
  onOpen: (() => void) | null;
  title: string;
}) {
  const formatDuration = useFormatDuration();
  const isNext = onOpen !== null;

  const name = (
    <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium">{title}</span>
  );

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={getRowClass({ finished: false, fold: NO_FOLD, isNext })}
    >
      <span className="flex h-5 w-3 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      {onOpen ? (
        <button
          aria-busy={busy || undefined}
          className={cn(ROW_OPEN_CLASS, "flex-1 after:inset-x-0")}
          data-slot="today-row-open"
          disabled={busy}
          onClick={onOpen}
          type="button"
        >
          {name}
        </button>
      ) : (
        name
      )}

      <span className="text-muted-foreground flex h-5 shrink-0 items-center font-mono text-xs tabular-nums">
        {formatDuration(minutes)}
      </span>
    </li>
  );
}

/** Not part of the session: never the next block, no mission mark, and the day's segments, time and action leave it out. */
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
