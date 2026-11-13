"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { PlusMark } from "../_components/plus-lock";
import { TestOutStartLink } from "../_components/test-out-start-link";
import { TITLE_ROW_CLASS, TRUNCATED_TITLE_CLASS } from "../_components/title-row";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { BlockMark } from "../session/block-mark";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { useTodayScreen } from "./today-context";
import { NEXT_TITLE_ID } from "./today-ids";
import { getLessonAgainId, isFinished } from "./today-queue";
import { LessonAgainLink, ROW_OPEN_CLASS, RowOpen } from "./today-row-open";
import { useStepLabel } from "./use-row-label";
import { useLessonGettingReady } from "./use-today-copy";

/** A row's mark and minutes center on a row of one or two lines and sit on the first of three. */
const THREE_LINES_CLASS = "has-[[data-slot=today-row-lines]>:nth-child(3)]:items-start";

export function getRowClass({ finished, isNext }: { finished: boolean; isNext: boolean }): string {
  return cn(
    "group/row relative isolate flex min-h-11 items-center gap-3 border-b last:border-b-0 has-[+[aria-current=step]]:border-b-0",
    "has-[[data-slot=today-row-open]:hover]:before:bg-muted/70 before:pointer-events-none before:absolute before:inset-y-0.5 before:-z-10 before:rounded-lg before:transition-colors",
    finished ? "py-[9px]" : "py-2.75",
    isNext
      ? "bg-muted -mx-2.5 my-0.5 rounded-lg border-b-0 px-2.5 before:inset-x-0"
      : "before:-inset-x-2.5",
    THREE_LINES_CLASS,
  );
}

/**
 * While the row's own open runs, its time turns into the spinner in place. The row is its own
 * group: the next row also holds "Take the test", a busy button of its own.
 */
function RowTime({ minutes }: { minutes: number }) {
  const formatDuration = useFormatDuration();

  return (
    <span className="relative">
      <span className="group-has-[[data-slot=today-row-open][aria-busy=true]]/row:invisible">
        {formatDuration(minutes)}
      </span>
      <Loader2Icon
        aria-hidden="true"
        className="absolute inset-y-0 right-0 my-auto hidden size-3.5 animate-spin group-has-[[data-slot=today-row-open][aria-busy=true]]/row:block"
      />
    </span>
  );
}

function RowName({ block, isNext }: { block: DayStep; isNext: boolean }) {
  const t = useExtracted();
  const title = useBlockTitle();

  return (
    <span
      className={cn(
        "line-clamp-2 text-sm leading-5 font-medium",
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

const ROW_LINE_CLASS = cn(TRUNCATED_TITLE_CLASS, "text-muted-foreground text-xs leading-4");

function RowLines({ block, isNext }: { block: DayStep; isNext: boolean }) {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const isGettingReady = useLessonGettingReady();
  const stepLabel = useStepLabel();
  const line = isGettingReady(block) ? t("Getting ready…") : stepLabel(block);

  return (
    <>
      {line && <span className={ROW_LINE_CLASS}>{line}</span>}

      {isNext && block.canTestOut && block.chapterId && (
        <div className="relative">
          <TestOutStartLink
            className="text-xs leading-4"
            onStart={() => actions.startTestOut(block.chapterId ?? "")}
          />
        </div>
      )}
    </>
  );
}

function RowTarget({
  block,
  isNext,
  lessonAgainId,
  opens,
}: {
  block: DayStep;
  isNext: boolean;
  lessonAgainId: string | null;
  opens: boolean;
}) {
  const name = <RowName block={block} isNext={isNext} />;

  if (lessonAgainId) {
    return (
      <LessonAgainLink block={block} lessonId={lessonAgainId}>
        {name}
      </LessonAgainLink>
    );
  }

  if (isFinished(block) || block.waitReason || !opens) {
    return name;
  }

  return (
    <RowOpen block={block} isNext={isNext}>
      {name}
    </RowOpen>
  );
}

/**
 * A finished row shows no minutes: they were the plan's estimate, and "✓ Reviews 8 min" above "2
 * min studied" read as time studied.
 */
export function BlockRow({
  block,
  isNext,
  opens = true,
}: {
  block: DayStep;
  isNext: boolean;
  opens?: boolean;
}) {
  const finished = isFinished(block);
  const lessonAgainId = getLessonAgainId(block);

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={cn(
        getRowClass({ finished, isNext }),
        lessonAgainId && "has-[a:hover]:before:bg-muted/70",
      )}
      data-slot={isNext ? "today-next" : undefined}
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        <BlockMark block={block} />
      </span>

      <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1", THREE_LINES_CLASS)}>
        <div className="flex flex-col gap-px" data-slot="today-row-lines">
          <RowTarget block={block} isNext={isNext} lessonAgainId={lessonAgainId} opens={opens} />

          {!finished && <RowLines block={block} isNext={isNext} />}
        </div>

        {!finished && (
          <span className="text-muted-foreground flex h-5 items-center font-mono text-xs tabular-nums">
            <RowTime minutes={block.estimatedMinutes} />
          </span>
        )}
      </div>
    </li>
  );
}

export function PlanLessonRow({
  busy,
  disabled = busy,
  minutes,
  onOpen,
  title,
}: {
  busy: boolean;
  disabled?: boolean;
  minutes: number;
  onOpen: (() => void) | null;
  title: string;
}) {
  const isNext = onOpen !== null;

  const name = (
    <span className={cn(TRUNCATED_TITLE_CLASS, "min-w-0 flex-1 text-sm leading-5 font-medium")}>
      {title}
    </span>
  );

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={cn(
        getRowClass({ finished: false, isNext }),
        isNext && disabled && !busy && "opacity-50",
      )}
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1")}>
        {onOpen ? (
          <button
            aria-busy={busy || undefined}
            aria-disabled={disabled || undefined}
            className={cn(ROW_OPEN_CLASS, "after:inset-x-0")}
            data-slot="today-row-open"
            onClick={disabled ? undefined : onOpen}
            type="button"
          >
            {name}
          </button>
        ) : (
          name
        )}

        <span className="text-muted-foreground flex h-5 items-center font-mono text-xs tabular-nums">
          <RowTime minutes={minutes} />
        </span>
      </div>
    </li>
  );
}

/**
 * Not part of the session: never the next block, no mission mark, and the day's segments, time and
 * action leave it out.
 */
export function PlusLessonRow({ title }: { title: string }) {
  const { actions } = useTodayScreen();

  return (
    <li
      className={cn(
        getRowClass({ finished: false, isNext: false }),
        "has-[a:hover]:before:bg-muted/70",
      )}
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        <KindMark kind="lesson" />
      </span>

      <LearnLink
        className={cn(ROW_OPEN_CLASS, "flex-1 items-center gap-3 after:-inset-x-2.5")}
        href={actions.plusHref}
        prefetch={false}
      >
        <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium">{title}</span>
        <PlusMark />
      </LearnLink>
    </li>
  );
}
