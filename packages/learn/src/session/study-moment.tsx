"use client";

import { Button, FORWARD_ICON, buttonVariants } from "@zoonk/ui/components/button";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, CircleStopIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { KindMark } from "../_components/kind-tile";
import { MomentReadouts } from "../_components/moment-readouts";
import { PageSectionLabel } from "../_components/page";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart, TestOutStartLink } from "../_components/test-out-start-link";
import { useFormatDuration } from "../_utils/time-format";
import { SCREEN_STEADY_MS, useSteady } from "../_utils/use-steady";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { LearnLink } from "../learn-link";
import { getOwnBrainPower } from "./block-brain-power";
import { getBlockKind } from "./block-kind";
import { DayMoment } from "./day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "./moment-ceremony";
import { MomentHeader } from "./moment-header";
import { MomentToday } from "./moment-today";
import { pickDayMoment } from "./pick-day-moment";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { SessionQueueAsideContent, useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock, type StudyMomentView } from "./session-types";
import { useBlockTitle } from "./use-block-copy";
import { type MomentKind, useMomentTitle } from "./use-moment-title";
import { useSessionAction } from "./use-session-action";

function NextBlock({ block, subject }: { block: StudyBlock; subject: boolean }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const blockTitle = useBlockTitle();

  return (
    <section
      className={cn("flex flex-col gap-2", !subject && "with-aside:hidden")}
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
 * On a phone Continue keeps the bar's bottom row, where the last answer's Continue was, so a quick
 * second tap never stops the session.
 */
function MomentActions({
  continueHref,
  onContinue,
  onStop,
  sessionCompleted,
}: {
  continueHref?: string | null;
  onContinue: () => Promise<boolean>;
  onStop: () => Promise<boolean>;
  sessionCompleted: boolean;
}) {
  const t = useExtracted();

  const proceed = useSessionAction({
    action: onContinue,
    enterKey: !continueHref,
    steadyMs: SCREEN_STEADY_MS,
  });

  // A second tap after the last answer's Continue would land right here, where Continue was.
  const stop = useSessionAction({ action: onStop, steadyMs: SCREEN_STEADY_MS });

  return (
    <TaskActionBar>
      {proceed.failed && (
        <ActionFailed>{t("We couldn't open the next step. Try again.")}</ActionFailed>
      )}
      {stop.failed && (
        <ActionFailed>{t("That didn't go through. Try again in a moment.")}</ActionFailed>
      )}

      <TaskActions className={cn(!sessionCompleted && "max-lg:flex-col max-lg:items-stretch")}>
        {!sessionCompleted && (
          <Button
            busy={stop.isPending}
            icon={<CircleStopIcon aria-hidden="true" />}
            onClick={stop.run}
            size="xl"
            variant="outline"
          >
            {t("Stop for today")}
          </Button>
        )}

        {continueHref ? (
          <MomentContinueLink href={continueHref} />
        ) : (
          <EnterButton busy={proceed.isPending} onClick={proceed.run} {...FORWARD_ICON}>
            {t("Continue")}
          </EnterButton>
        )}
      </TaskActions>
    </TaskActionBar>
  );
}

export function StudyMoment({
  continueHref,
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
  continueHref?: string | null;
  buddy?: LearnBuddy | null;
  exitHref?: string;
  finishedChapterId?: string | null;
  inLessonPlayer?: boolean;
  kind: MomentKind;
  moment: StudyMomentView;
  next: StudyBlock | null;
  onContinue: () => Promise<boolean>;
  onStartTestOut?: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  renderCeremony?: MomentCeremony;
  testedOut?: boolean;
}) {
  const title = useMomentTitle({ kind, testedOut });
  const nextBlock = moment.sessionCompleted ? null : next;
  const hasHeader = !inLessonPlayer && exitHref !== undefined;

  const queue = {
    left: moment.minutes.left,
    rows: getSessionQueue({
      blocks: moment.blocks,
      finishedId: moment.blockId,
      nextId: nextBlock?.id ?? null,
    }),
  };

  const aside = useSessionQueueAside(queue);

  const nextChapterId =
    nextBlock?.canTestOut && nextBlock.chapterId !== finishedChapterId ? nextBlock.chapterId : null;

  // After a run of easy lessons core offers the chapter's test; before a new chapter the next
  // lesson's can be taken. Either way it's one line, the one Today uses.
  const testChapterId = moment.testOutOffer?.chapterId ?? nextChapterId;

  const dayMoment = {
    ceremony: moment.ceremony,
    finishedChapter: moment.finishedChapter,
    missionMoment: {
      completed: moment.completedMissions,
      fullMeal: moment.fullMeal,
      missions: moment.missions,
    },
    reached: moment.reached,
  };

  // The day's bonus is said by the missions' moment; where another moment shows instead, the bonus
  // is part of what this block earned.
  const brainPower =
    pickDayMoment(dayMoment) === "missions" ? getOwnBrainPower(moment) : moment.brainPower;

  const content = (
    <MomentAfterCeremony moments={moment} render={renderCeremony}>
      <TaskBody data-slot="study-moment">
        <MomentHeader title={title}>
          <MomentReadouts brainPower={brainPower} />
        </MomentHeader>

        <MomentToday moment={moment} rows={queue.rows} />

        <DayMoment buddy={buddy} {...dayMoment} />

        {nextBlock && (
          <NextBlock block={nextBlock} subject={Boolean(testChapterId && onStartTestOut)} />
        )}

        {testChapterId && onStartTestOut && (
          <TestOutStartLink onStart={() => onStartTestOut(testChapterId)} />
        )}
      </TaskBody>

      <MomentActions
        continueHref={continueHref}
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
      <SessionHeader exitHref={exitHref} />
      {content}
    </SessionFrame>
  );
}

function MomentContinueLink({ href }: { href: string }) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>();
  const steady = useSteady(SCREEN_STEADY_MS);

  return (
    <LearnLink
      className={buttonVariants({ size: "xl" })}
      href={href}
      lessonWritten
      onClick={(event) => {
        if (!steady()) {
          event.preventDefault();
        }
      }}
      ref={ref}
    >
      {t("Continue")}
      <ArrowRightIcon aria-hidden="true" className="size-4" />
    </LearnLink>
  );
}
