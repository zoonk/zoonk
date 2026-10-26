"use client";

import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useEffect, useRef } from "react";
import { EnterButton } from "../_components/enter-button";
import { KindMark } from "../_components/kind-tile";
import { MomentReadouts } from "../_components/moment-readouts";
import { PageSectionLabel } from "../_components/page";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart, TestOutStartLink } from "../_components/test-out-start-link";
import { isFocusLost } from "../_utils/is-focus-lost";
import { useFormatDuration } from "../_utils/time-format";
import { SCREEN_STEADY_MS } from "../_utils/use-steady";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { getOwnBrainPower } from "./block-brain-power";
import { getBlockKind } from "./block-kind";
import { DayMoment } from "./day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "./moment-ceremony";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { SessionQueueAsideContent, useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock, type StudyMomentView } from "./session-types";
import { TestOutOffer } from "./test-out-offer";
import { useBlockTitle } from "./use-block-copy";
import { type MomentKind, useMomentTitle } from "./use-moment-title";
import { useSessionAction } from "./use-session-action";

/**
 * What the block earned: its Brain Power as a readout (never "+0"), then on one quiet line the day
 * a lesson comes back (as a date, never a weekday that could be this one or the next) and its net
 * score when it's scored like an exam where a wrong answer cancels a right one. The day's bonus,
 * when the block paid it, is the missions' to show, so the readout counts only the block's own
 * points.
 */
function MomentEarned({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();
  const format = useFormatter();
  const brainPower = getOwnBrainPower(moment);

  const facts = [
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

  return <MomentReadouts brainPower={brainPower} facts={facts} />;
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
      <PageSectionLabel>{t("Up next")}</PageSectionLabel>
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
 * Today), or "See today's summary" alone once the session is done. On a phone Continue keeps the
 * bar's bottom row, where the last answer's Continue was, and "Stop for today" sits above it, so a
 * quick second tap never stops the session.
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

  const proceed = useSessionAction({
    action: onContinue,
    enterKey: true,
    steadyMs: SCREEN_STEADY_MS,
  });

  // A second tap after the last answer's Continue would land right here, where Continue was.
  const stop = useSessionAction({ action: onStop, steadyMs: SCREEN_STEADY_MS });

  return (
    <TaskActionBar>
      {proceed.failed && (
        <ActionFailed>{t("We couldn't open the next step. Try again.")}</ActionFailed>
      )}
      {stop.failed && <ActionFailed>{t("We couldn't stop the session. Try again.")}</ActionFailed>}

      <TaskActions className={cn(!sessionCompleted && "max-lg:flex-col max-lg:items-stretch")}>
        {!sessionCompleted && (
          <Button disabled={stop.isPending} onClick={stop.run} size="xl" variant="outline">
            {t("Stop for today")}
          </Button>
        )}

        <EnterButton disabled={proceed.isPending} onClick={proceed.run}>
          {proceed.isPending && <Spinner aria-hidden="true" />}
          {sessionCompleted ? t("See today's summary") : t("Continue")}
        </EnterButton>
      </TaskActions>
    </TaskActionBar>
  );
}

/**
 * The moment's title, which takes the focus when the screen before it left none (the last answer's
 * Continue went with it), so a screen reader starts here and reads on.
 */
function MomentTitle({ title }: { title: string }) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isFocusLost(document.activeElement)) {
      heading.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <h2 className="text-title outline-none" ref={heading} tabIndex={-1}>
      {title}
    </h2>
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
  buddy,
  exitHref,
  inLessonPlayer = false,
  kind,
  moment,
  next,
  finishedChapterId = null,
  onContinue,
  onStartTestOut,
  onStop,
  renderCeremony,
  testedOut = false,
}: {
  /** The day's blocks, for its queue beside the moment. */
  blocks: readonly StudyBlock[];
  /** The learner's buddy, who cheers when the block completes one of the day's missions. */
  buddy?: LearnBuddy | null;
  /** Where leaving goes, for the moment's own header; inside the lesson player it has none. */
  exitHref?: string;
  /** The chapter of the lesson just finished: a next lesson in another one starts a chapter. */
  finishedChapterId?: string | null;
  /** Inside the lesson player, whose header holds the page's heading (the lesson's title). */
  inLessonPlayer?: boolean;
  kind: MomentKind;
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
  /** The full-screen moment for a milestone the block earned (`moment.ceremony`), over this one. */
  renderCeremony?: MomentCeremony;
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
    <MomentAfterCeremony milestone={moment.ceremony} render={renderCeremony}>
      <TaskBody data-slot="study-moment">
        <div className="flex flex-col items-start gap-6">
          <MomentTitle title={title} />
          <MomentEarned moment={moment} />
        </div>

        <DayMoment
          buddy={buddy}
          ceremony={moment.ceremony}
          missionMoment={{
            completed: moment.completedMissions,
            fullMeal: moment.fullMeal,
            missions: moment.missions,
          }}
          reached={moment.reached}
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
    </MomentAfterCeremony>
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
