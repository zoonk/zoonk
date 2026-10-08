"use client";

import { Button } from "@zoonk/ui/components/button";
import { CalendarClockIcon, CheckIcon, ScaleIcon, ZapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { type TestOutStart, TestOutStartLink } from "../_components/test-out-start-link";
import { getBlockKind } from "./block-kind";
import { SessionBar } from "./session-bar";
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
 * A lesson's ideas are sealed until their review: the day they come back, as a date (never a
 * weekday that could be this one or the next).
 */
function ComesBackChip({ date }: { date: string }) {
  const t = useExtracted();
  const format = useFormatter();

  const day = format.dateTime(new Date(`${date}T00:00:00Z`), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <FactChip>
      <CalendarClockIcon aria-hidden="true" />
      {t("Review on {date}", { date: day })}
    </FactChip>
  );
}

/**
 * What the block earned, as chips: its net score when it's scored like an exam where a wrong
 * answer cancels a right one, its Brain Power (never "+0") and the day a lesson comes back.
 */
function MomentFacts({ moment }: { moment: StudyMomentView }) {
  const t = useExtracted();

  const hasFacts = moment.netScore !== null || moment.brainPower > 0 || moment.comesBackOn !== null;

  if (!hasFacts) {
    return null;
  }

  return (
    <FactChips className="justify-center">
      {moment.netScore !== null && (
        <FactChip>
          <ScaleIcon aria-hidden="true" />
          {/* The block's right and wrong statements were counted live while answering. */}
          {t("Net score {net}", { net: String(moment.netScore) })}
        </FactChip>
      )}

      {moment.brainPower > 0 && (
        <FactChip>
          <ZapIcon aria-hidden="true" />
          {t("+{points} Brain Power", { points: String(moment.brainPower) })}
        </FactChip>
      )}

      {moment.comesBackOn && <ComesBackChip date={moment.comesBackOn} />}
    </FactChips>
  );
}

/** What Continue opens, right above it: the next block with its kind's tile. */
function NextBlock({ block }: { block: StudyBlock }) {
  const t = useExtracted();
  const blockTitle = useBlockTitle();

  return (
    <div
      className="bg-muted/60 flex items-center gap-3 rounded-2xl p-3 text-left"
      data-slot="study-moment-next"
    >
      <KindTile kind={getBlockKind(block)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground text-xs font-medium">{t("Up next")}</span>
        <span className="truncate text-sm font-medium">{blockTitle(block)}</span>
      </div>
      <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
        {t("{minutes} min", { minutes: String(block.estimatedMinutes) })}
      </span>
    </div>
  );
}

function StopButton({ onStop }: { onStop: () => Promise<boolean> }) {
  const t = useExtracted();
  const { failed, isPending, run } = useSessionAction({ action: onStop });

  return (
    <>
      <Button
        className="min-h-11 self-center"
        disabled={isPending}
        onClick={run}
        size="lg"
        variant="ghost"
      >
        {t("Stop for today")}
      </Button>

      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("We couldn't stop the session. Try again.")}
        </p>
      )}
    </>
  );
}

/**
 * The quick moment between the session's blocks: a check that pops in, what the block earned as
 * chips and the day's progress on the session bar (the only place the whole session shows), then
 * what comes next right above the one button that opens it (or Enter). "Stop for today" leaves the
 * rest for later. The full summary waits for the end of the session. On phones the button sits at
 * the bottom; on wide screens the moment and its button stay together in the middle.
 */
export function StudyMoment({
  inLessonPlayer = false,
  kind,
  moment,
  next,
  finishedChapterId = null,
  onContinue,
  onStartTestOut,
  onStop,
  testedOut = false,
}: {
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
  testedOut?: boolean;
}) {
  const t = useExtracted();
  const title = useMomentTitle({ kind, testedOut });
  const { failed, isPending, run } = useSessionAction({ action: onContinue, enterKey: true });
  const Title = inLessonPlayer ? "h2" : "h1";
  const nextBlock = moment.sessionCompleted ? null : next;
  const offer = onStartTestOut ? moment.testOutOffer : null;

  // A next lesson that starts a chapter can be skipped from here too, unless a test is offered.
  const nextChapterId =
    !offer && nextBlock?.kind === "learn" && nextBlock.chapterId !== finishedChapterId
      ? nextBlock.chapterId
      : null;

  return (
    <section className="flex flex-1 flex-col py-6 lg:justify-center-safe" data-slot="study-moment">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center lg:flex-none">
        <span className="bg-success/10 text-success animate-in zoom-in-50 fade-in flex size-20 items-center justify-center rounded-full duration-500 ease-out motion-reduce:animate-none">
          <CheckIcon aria-hidden="true" className="size-10" strokeWidth={2.5} />
        </span>

        <div className="flex flex-col items-center gap-4" role="status">
          <Title className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {title}
          </Title>
          <MomentFacts moment={moment} />
        </div>

        <SessionBar
          className="max-w-xs"
          completed={moment.sessionBar.completed}
          total={moment.sessionBar.total}
        />

        {offer && onStartTestOut && <TestOutOffer offer={offer} onStart={onStartTestOut} />}
      </div>

      <div className="flex flex-col gap-3 pt-8">
        {nextBlock && <NextBlock block={nextBlock} />}

        {nextChapterId && onStartTestOut && (
          <TestOutStartLink onStart={() => onStartTestOut(nextChapterId)} />
        )}

        <EnterButton disabled={isPending} onClick={run}>
          {moment.sessionCompleted ? t("See what changed") : t("Continue")}
        </EnterButton>

        {failed && (
          <p className="text-destructive text-center text-sm" role="alert">
            {t("We couldn't open the next step. Try again.")}
          </p>
        )}

        {!moment.sessionCompleted && <StopButton onStop={onStop} />}
      </div>
    </section>
  );
}
