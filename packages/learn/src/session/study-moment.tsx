"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { KindMark } from "../_components/kind-tile";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { type TestOutStart, TestOutStartLink } from "../_components/test-out-start-link";
import { useFormatDuration } from "../_utils/time-format";
import { MissionMoment } from "../missions/mission-moment";
import { getBlockKind } from "./block-kind";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { SessionQueueAsideContent, useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock, type StudyMomentView } from "./session-types";
import { TestOutOffer } from "./test-out-offer";
import { useBlockTitle } from "./use-block-copy";
import { useSessionAction } from "./use-session-action";

type MomentKind = StudyBlock["kind"];

function useMomentTitle({ kind, testedOut }: { kind: MomentKind; testedOut: boolean }) {
  const t = useExtracted();

  if (kind === "learn") {
    return testedOut ? t("You already knew this") : t("Lesson complete");
  }

  if (kind === "review") {
    return t("Review done");
  }

  return t("Practice done");
}

/**
 * What the block earned, as one mono line: its Brain Power (never "+0"), the day a lesson comes
 * back (as a date, never a weekday that could be this one or the next) and its net score when it's
 * scored like an exam where a wrong answer cancels a right one.
 */
function MomentFacts({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();
  const format = useFormatter();

  const facts = [
    moment.brainPower > 0 &&
      t("+{points} Brain Power", { points: format.number(moment.brainPower) }),
    moment.comesBackOn &&
      t("Review on {date}", {
        date: format.dateTime(new Date(`${moment.comesBackOn}T00:00:00Z`), {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        }),
      }),
    // The block's right and wrong statements were counted live while answering.
    moment.netScore !== null && t("Net score {net}", { net: String(moment.netScore) }),
  ];

  return <TaskMeta facts={facts} />;
}

/**
 * What Continue opens: the next block as the list's highlighted "next" row, its kind's dot, its
 * name and its minutes. From `lg` the day's queue beside the moment highlights the same row, so the
 * moment leaves it out there, unless something under it is about it (`subject`: taking the next
 * lesson's test).
 */
function NextBlock({ block, subject }: { block: StudyBlock; subject: boolean }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const blockTitle = useBlockTitle();

  return (
    <section
      className={cn("flex flex-col gap-2", !subject && "lg:hidden")}
      data-slot="study-moment-next"
    >
      <h3 className="text-label">{t("Up next")}</h3>
      <div className="bg-muted -mx-2.5 flex items-center gap-3 rounded-[0.625rem] px-2.5 py-2.75">
        <KindMark kind={getBlockKind(block)} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{blockTitle(block)}</span>
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {formatDuration(block.estimatedMinutes)}
        </span>
      </div>
    </section>
  );
}

function ActionFailed({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-destructive-text text-sm" role="alert">
      {children}
    </p>
  );
}

/**
 * The moment's action bar: "Stop for today" beside Continue (what's done counts, the rest waits on
 * Today), or "See what changed" alone once the session is done.
 */
function MomentActions({
  onContinue,
  onStop,
  sessionCompleted,
}: {
  onContinue: () => Promise<boolean>;
  onStop: () => Promise<boolean>;
  sessionCompleted: boolean;
}) {
  const t = useExtracted();
  const proceed = useSessionAction({ action: onContinue, enterKey: true });
  const stop = useSessionAction({ action: onStop });

  return (
    <TaskActionBar>
      {proceed.failed && (
        <ActionFailed>{t("We couldn't open the next step. Try again.")}</ActionFailed>
      )}
      {stop.failed && <ActionFailed>{t("We couldn't stop the session. Try again.")}</ActionFailed>}

      <TaskActions>
        {!sessionCompleted && (
          <Button disabled={stop.isPending} onClick={stop.run} size="xl" variant="outline">
            {t("Stop for today")}
          </Button>
        )}

        <EnterButton disabled={proceed.isPending} onClick={proceed.run}>
          {sessionCompleted ? t("See what changed") : t("Continue")}
        </EnterButton>
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * The quick moment between the session's blocks, with the same chrome as every task: the day's
 * session bar in the header, then on the page what the block was ("Review done"), what it earned
 * in one mono line, and what comes next as the highlighted next row. The action bar holds "Stop
 * for today" beside Continue (or Enter). From `lg` the aside lists the day's queue, as Today does,
 * its next row highlighted, in the next row's place.
 * The full summary waits for the end of the session. Inside the lesson player the host's
 * completion header shows the day (`LessonMomentHeader`) and the queue takes the player's aside.
 */
export function StudyMoment({
  blocks,
  exitHref,
  inLessonPlayer = false,
  kind,
  missionsBefore,
  moment,
  next,
  finishedChapterId = null,
  onContinue,
  onStartTestOut,
  onStop,
  testedOut = false,
}: {
  /** The day's blocks, for its queue beside the moment. */
  blocks: readonly StudyBlock[];
  /** Where leaving goes, for the moment's own header; inside the lesson player it has none. */
  exitHref?: string;
  /** The chapter of the lesson just finished: a next lesson in another one starts a chapter. */
  finishedChapterId?: string | null;
  /** Inside the lesson player, whose header holds the page's heading (the lesson's title). */
  inLessonPlayer?: boolean;
  kind: MomentKind;
  /** The day's missions before the block, so the moment says which one it completed. */
  missionsBefore?: StudyMomentView["missions"];
  moment: StudyMomentView;
  /** The block that comes next, shown above Continue. */
  next: StudyBlock | null;
  onContinue: () => Promise<boolean>;
  /**
   * Opens a chapter's test: the one a lesson's moment offers (`moment.testOutOffer`), or the next
   * lesson's when it starts a chapter. Without it, neither shows.
   */
  onStartTestOut?: (chapterId: string) => Promise<TestOutStart>;
  /** "Stop for today" between blocks: what's done counts, the rest waits on Today. */
  onStop: () => Promise<boolean>;
  testedOut?: boolean;
}) {
  const title = useMomentTitle({ kind, testedOut });
  const nextBlock = moment.sessionCompleted ? null : next;
  const offer = onStartTestOut ? moment.testOutOffer : null;
  const hasHeader = !inLessonPlayer && exitHref !== undefined;

  const queue = getSessionQueue({
    blocks,
    finishedId: moment.blockId,
    nextId: nextBlock?.id ?? null,
  });

  const aside = useSessionQueueAside(queue);

  // A next lesson that starts a chapter can be skipped from here too, unless a test is offered.
  const nextChapterId =
    !offer && nextBlock?.canTestOut && nextBlock.chapterId !== finishedChapterId
      ? nextBlock.chapterId
      : null;

  const content = (
    <>
      <TaskBody data-slot="study-moment">
        <div className="flex flex-col gap-2" role="status">
          <h2 className="text-title">{title}</h2>
          <MomentFacts moment={moment} />
        </div>

        <MissionMoment
          before={missionsBefore}
          fullMeal={moment.fullMeal}
          missions={moment.missions}
        />

        {nextBlock && (
          <NextBlock block={nextBlock} subject={Boolean(nextChapterId && onStartTestOut)} />
        )}

        {offer && onStartTestOut && <TestOutOffer offer={offer} onStart={onStartTestOut} />}

        {nextChapterId && onStartTestOut && (
          <TestOutStartLink onStart={() => onStartTestOut(nextChapterId)} />
        )}
      </TaskBody>

      <MomentActions
        onContinue={onContinue}
        onStop={onStop}
        sessionCompleted={moment.sessionCompleted}
      />
    </>
  );

  if (!hasHeader) {
    return (
      <>
        <SessionQueueAsideContent queue={queue} />
        {content}
      </>
    );
  }

  return (
    <SessionFrame aside={aside}>
      <SessionHeader exitHref={exitHref} queue={queue.rows} sessionBar={moment.sessionBar} />
      {content}
    </SessionFrame>
  );
}
