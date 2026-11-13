"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleStopIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton, EnterLink } from "../_components/enter-button";
import { KindMark } from "../_components/kind-tile";
import { MomentReadouts } from "../_components/moment-readouts";
import { PageSectionLabel } from "../_components/page";
import { TaskActionBar, TaskActions, TaskBody } from "../_components/task-layout";
import { type TestOutStart, TestOutStartLink } from "../_components/test-out-start-link";
import { useFormatDuration, useStudyTimeFact } from "../_utils/time-format";
import { SCREEN_STEADY_MS, useSteady } from "../_utils/use-steady";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { FinishedChapterMoment } from "../mind-maps/finished-chapter-map";
import { ReminderOffer, type ReminderOfferActions } from "../reminders/reminder-offer";
import { getOwnBrainPower } from "./block-brain-power";
import { getBlockKind } from "./block-kind";
import { DayMoment } from "./day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "./moment-ceremony";
import { MomentHeader } from "./moment-header";
import { MomentCatchUp, MomentToday } from "./moment-today";
import { SessionFrame } from "./session-frame";
import { SessionHeader } from "./session-header";
import { SessionQueueAsideContent, useSessionQueueAside } from "./session-queue";
import { getSessionQueue } from "./session-queue-rows";
import { type StudyBlock, type StudyMomentView } from "./session-types";
import { TestOutOffer } from "./test-out-offer";
import { useBlockTitle } from "./use-block-copy";
import { type MomentKind, useMomentTitle } from "./use-moment-title";
import { useSessionAction } from "./use-session-action";

function MomentEarned({
  lessonSeconds = 0,
  moment,
}: {
  lessonSeconds?: number;
  moment: StudyMomentView;
}) {
  const t = useExtracted();
  const studied = useStudyTimeFact(lessonSeconds);
  const brainPower = getOwnBrainPower(moment);

  const facts = [
    studied,
    moment.netScore !== null && t("Net score {net}", { net: String(moment.netScore) }),
  ];

  return (
    <MomentReadouts brainPower={brainPower} facts={facts}>
      <MomentCatchUp catchUp={moment.dayProgress.catchUp} />
    </MomentReadouts>
  );
}

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
      <div className="bg-muted -mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-2.75">
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
      {stop.failed && <ActionFailed>{t("We couldn't stop the session. Try again.")}</ActionFailed>}

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
          <EnterButton busy={proceed.isPending} enter="host" onClick={proceed.run}>
            {sessionCompleted ? t("See today's summary") : t("Continue")}
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
  lessonSeconds,
  moment,
  next,
  finishedChapterId = null,
  onContinue,
  onStartTestOut,
  onStop,
  reminderActions,
  renderCeremony,
  testedOut = false,
}: {
  continueHref?: string | null;
  buddy?: LearnBuddy | null;
  exitHref?: string;
  finishedChapterId?: string | null;
  inLessonPlayer?: boolean;
  kind: MomentKind;
  lessonSeconds?: number;
  moment: StudyMomentView;
  next: StudyBlock | null;
  onContinue: () => Promise<boolean>;
  onStartTestOut?: (chapterId: string) => Promise<TestOutStart>;
  onStop: () => Promise<boolean>;
  reminderActions?: ReminderOfferActions;
  renderCeremony?: MomentCeremony;
  testedOut?: boolean;
}) {
  const title = useMomentTitle({ kind, testedOut });
  const nextBlock = moment.sessionCompleted ? null : next;
  const offer = onStartTestOut ? moment.testOutOffer : null;
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
    !offer && nextBlock?.canTestOut && nextBlock.chapterId !== finishedChapterId
      ? nextBlock.chapterId
      : null;

  const content = (
    <MomentAfterCeremony moments={moment} render={renderCeremony}>
      <TaskBody data-slot="study-moment">
        <MomentHeader title={title}>
          <MomentEarned lessonSeconds={lessonSeconds} moment={moment} />
        </MomentHeader>

        <MomentToday moment={moment} rows={queue.rows} />

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

        <FinishedChapterMoment chapter={moment.finishedChapter} />

        <ReminderOffer actions={reminderActions} offer={moment.reminderOffer} />

        {nextBlock && (
          <NextBlock block={nextBlock} subject={Boolean(nextChapterId && onStartTestOut)} />
        )}

        {offer && onStartTestOut && <TestOutOffer offer={offer} onStart={onStartTestOut} />}

        {nextChapterId && onStartTestOut && (
          <TestOutStartLink onStart={() => onStartTestOut(nextChapterId)} />
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
  const steady = useSteady(SCREEN_STEADY_MS);

  return (
    <EnterLink
      href={href}
      lessonWritten
      onClick={(event) => {
        if (!steady()) {
          event.preventDefault();
        }
      }}
    >
      {t("Continue")}
    </EnterLink>
  );
}
