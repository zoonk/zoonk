"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import { ListChecksIcon, Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindMark } from "../_components/kind-tile";
import { TestOutStartLink } from "../_components/test-out-start-link";
import { TITLE_ROW_CLASS, TRUNCATED_TITLE_CLASS } from "../_components/title-row";
import { useFormatDuration } from "../_utils/time-format";
import { type MissionView } from "../missions/mission-links";
import { BlockMark } from "../session/block-mark";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { useTodayScreen } from "./today-context";
import { NEXT_TITLE_ID } from "./today-ids";
import { getLessonAgainId, isFinished } from "./today-queue";
import { LessonAgainLink, ROW_OPEN_CLASS, RowOpen } from "./today-row-open";
import { useBlockSubject, useStepLabel } from "./use-row-label";
import { useLessonGettingReady } from "./use-today-copy";

export function getRowClass({ isNext }: { isNext: boolean }): string {
  return cn(
    "group/row relative isolate flex min-h-11 items-center gap-3 border-b py-2.75 last:border-b-0 has-[+[aria-current=step]]:border-b-0",
    "before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-lg before:transition-colors",
    isNext
      ? "before:bg-muted border-b-0"
      : "[@media(hover:hover)]:has-[[data-slot=today-row-open]:hover]:before:bg-muted/70",
  );
}

/** The row's own open replaces its time with a spinner, leaving the test offer independent. */
function RowTime({ minutes }: { minutes: number }) {
  const formatDuration = useFormatDuration();

  return (
    <span className="relative text-end">
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

function opensStep(opens: MissionView["opens"], step: DayStep): boolean {
  if (opens?.kind !== "block") {
    return false;
  }

  return "blockId" in opens
    ? "id" in step && opens.blockId === step.id
    : opens.ref.position === step.position;
}

/** A step still to do that one of today's open missions asks for. */
function useCountsTowardMission() {
  const { missions } = useTodayScreen();

  return (step: DayStep): boolean =>
    Boolean(
      !missions?.fullMeal.earned &&
      !isFinished(step) &&
      missions?.missions.some(
        (mission) =>
          mission.status === "todo" && !mission.waitReason && opensStep(mission.opens, step),
      ),
    );
}

function RowName({ block, isNext }: { block: DayStep; isNext: boolean }) {
  const t = useExtracted();
  const title = useBlockTitle();
  const countsTowardMission = useCountsTowardMission()(block);

  return (
    <span
      className={cn(
        "text-sm leading-5 font-medium text-balance",
        isFinished(block) && "text-muted-foreground",
      )}
      id={isNext ? NEXT_TITLE_ID : undefined}
    >
      {title(block)}
      {block.status === "completed" && <span className="sr-only">{t(", done")}</span>}
      {block.status === "skipped" && <span className="sr-only">{t(", skipped")}</span>}
      {countsTowardMission && <span className="sr-only">{t(", counts toward a mission")}</span>}
    </span>
  );
}

const ROW_LINE_CLASS = cn(TRUNCATED_TITLE_CLASS, "text-muted-foreground text-xs leading-4");

function RowLines({
  block,
  isNext,
  showSubject,
}: {
  block: DayStep;
  isNext: boolean;
  showSubject: boolean;
}) {
  const t = useExtracted();
  const { actions } = useTodayScreen();
  const isGettingReady = useLessonGettingReady();
  const stepLabel = useStepLabel({ includeSubject: false });
  const subject = useBlockSubject()(block);
  const line = isGettingReady(block) ? t("Getting ready…") : stepLabel(block);

  return (
    <>
      {(showSubject || block.subjectExtra) && subject && (
        <span className={ROW_LINE_CLASS}>{subject}</span>
      )}
      {!isFinished(block) && line && <span className={ROW_LINE_CLASS}>{line}</span>}

      {isNext && block.canTestOut && block.chapterId && (
        <TestOutStartLink compact onStart={() => actions.startTestOut(block.chapterId ?? "")} />
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

/** Work past the day's list: it never counts toward the day's progress. */
function ExtraTag() {
  const t = useExtracted();

  return (
    <Badge className="font-sans" variant="outline">
      {t({
        description:
          "Tags a row of today's study list the learner added after the day's list, which doesn't count toward the day's progress.",
        message: "Extra",
      })}
    </Badge>
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
  showSubject,
}: {
  block: DayStep;
  isNext: boolean;
  opens?: boolean;
  showSubject: boolean;
}) {
  const finished = isFinished(block);
  const countsTowardMission = useCountsTowardMission()(block);
  const lessonAgainId = getLessonAgainId(block);

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={cn(
        getRowClass({ isNext }),
        lessonAgainId && "[@media(hover:hover)]:has-[a:hover]:before:bg-muted/70",
      )}
      data-slot={isNext ? "today-next" : undefined}
    >
      <span className="flex h-5 w-4 shrink-0 items-center justify-center">
        <BlockMark block={block} />
      </span>

      <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1")}>
        <div className="flex flex-col gap-px" data-slot="today-row-lines">
          <RowTarget block={block} isNext={isNext} lessonAgainId={lessonAgainId} opens={opens} />

          <RowLines block={block} isNext={isNext} showSubject={showSubject} />
        </div>

        {(block.extra || !finished) && (
          <span className="text-muted-foreground flex h-5 shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums">
            {block.extra && <ExtraTag />}
            {countsTowardMission && (
              <ListChecksIcon
                aria-hidden="true"
                className="text-brain size-3.5"
                data-slot="mission-row-mark"
              />
            )}
            {!finished && <RowTime minutes={block.estimatedMinutes} />}
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
    <span className="min-w-0 flex-1 text-sm leading-5 font-medium text-balance">{title}</span>
  );

  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={cn(getRowClass({ isNext }), isNext && disabled && !busy && "opacity-50")}
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
