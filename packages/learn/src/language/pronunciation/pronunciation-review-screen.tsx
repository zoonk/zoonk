"use client";

import {
  type PronunciationAnswerGrade,
  type PronunciationReviewsView,
  type PronunciationRoundResult,
} from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon, RotateCcwIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { FeedbackVerdict } from "../../_components/feedback-panel";
import { MomentReadouts } from "../../_components/moment-readouts";
import { TASK_HEADER_ICON_CLASS, TaskHeaderTitle } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { DayMoment } from "../../session/day-moment";
import { MomentAfterCeremony, type MomentCeremony } from "../../session/moment-ceremony";
import { MomentHeader } from "../../session/moment-header";
import { TaskFrame, TaskMainButton, TaskMainLink, TaskSaveError } from "../../shell/task-frame";
import { RecordButton } from "../../speech/record-button";
import { PronunciationWord, RecorderStatus, useWordRecorder } from "./pronunciation-word-card";
import { type PronunciationRoundActions, usePronunciationRound } from "./use-pronunciation-round";

export type {
  PronunciationAnswerOutcome,
  PronunciationRoundActions,
} from "./use-pronunciation-round";

const PERCENT = 100;

/** What the grader heard, and when the word comes back. */
function GradeNote({ grade }: { grade: PronunciationAnswerGrade }) {
  const t = useExtracted();
  const format = useFormatter();
  const nextReview = grade.nextReviewAt ? new Date(grade.nextReviewAt) : null;

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-1" role="status">
      {grade.isCorrect ? (
        <FeedbackVerdict tone="right">{t("That sounded right")}</FeedbackVerdict>
      ) : (
        <p className="font-semibold">{t("We heard “{heard}”", { heard: grade.transcript })}</p>
      )}

      <p className="text-muted-foreground text-sm">
        {nextReview
          ? t("It comes back {date}.", {
              date: format.dateTime(nextReview, { day: "numeric", month: "long" }),
            })
          : t("You've got this one. It won't come back.")}
      </p>
    </div>
  );
}

/**
 * The round's end, as every task's end reads, at the top of the task's column: "Practice done"
 * with what an accent means under it, the words said right and the Brain Power it paid as
 * readouts, then what it did to the day 24px under them; with nothing said, its own title.
 */
function RoundResult({
  buddy,
  result,
}: {
  buddy?: LearnBuddy | null;
  result: PronunciationRoundResult | null;
}) {
  const t = useExtracted();

  return (
    <>
      <MomentHeader
        detail={t(
          "An accent never blocks you. Words that still sound different come back tomorrow.",
        )}
        title={result ? t("Practice done") : t("Nothing said this time")}
      >
        {result && (
          <MomentReadouts
            brainPower={result.brainPower}
            score={{ answered: result.total, correct: result.correct }}
          />
        )}
      </MomentHeader>

      {result && (
        <DayMoment
          buddy={buddy}
          ceremony={result.ceremony}
          missionMoment={result.missionMoment}
          reached={result.reached}
        />
      )}
    </>
  );
}

/** The screen's "…" menu, for skipping a word the learner can't say right now. */
function WordMenu({ disabled, onSkip }: { disabled: boolean; onSkip: () => void }) {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className={cn("shrink-0", TASK_HEADER_ICON_CLASS.end)}
            size="icon"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("Screen options")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={disabled} onClick={onSkip}>
          <SkipForwardIcon aria-hidden="true" />
          {t("Skip this word")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Pronunciation reviews, full screen: each word the learner mispronounced comes back on the page
 * with its native sound, a slow version, the respelling and the tip; they record it, see what we
 * heard, and try again or go on, and the round counts toward their day at the end. A word they
 * can't say right now is skipped from the "…" menu (or from the action bar, when there's no
 * microphone). A milestone the round earned opens before its result, on its own. Nothing due
 * shows a short note. Leaving goes back where the round was opened (Today, a unit).
 *
 * ```tsx
 * <PronunciationReviewScreen actions={actions} exitHref="/today" reviews={reviews} />
 * ```
 */
export function PronunciationReviewScreen({
  actions,
  buddy,
  exitHref,
  renderCeremony,
  reviews,
}: {
  actions: PronunciationRoundActions;
  /** The learner's buddy, glad about the missions the round completes. */
  buddy?: LearnBuddy | null;
  exitHref: string;
  /** The full-screen moment for a milestone the round earned (a new belt, new glasses). */
  renderCeremony?: MomentCeremony;
  reviews: PronunciationReviewsView;
}) {
  const t = useExtracted();
  const round = usePronunciationRound({ actions, words: reviews.words });
  const mic = useWordRecorder(round.record);
  const { current, step } = round;
  const total = round.segments.length;

  if (step.kind === "result" || !current) {
    const result = step.kind === "result" ? step.result : null;

    return (
      <MomentAfterCeremony milestone={result?.ceremony ?? null} render={renderCeremony}>
        <TaskFrame
          exitHref={exitHref}
          exitToApp
          footer={
            <TaskActions>
              <TaskMainLink href={exitHref} toApp>
                {t("Done")}
              </TaskMainLink>
            </TaskActions>
          }
          headerTitle={<TaskHeaderTitle title={t("Say it again")} />}
        >
          {total === 0 ? (
            <p className="text-title py-6 text-balance" role="status">
              {t("No words to say again today.")}
            </p>
          ) : (
            <RoundResult buddy={buddy} result={result} />
          )}
        </TaskFrame>
      </MomentAfterCeremony>
    );
  }

  const graded = step.word.kind === "graded" ? step.word.grade : null;
  const notice = step.word.kind === "ready" ? step.word.notice : null;
  const isLast = round.index + 1 === total;
  const recording = mic.recorder.status === "recording";

  const position = t("Word {current, number} of {total, number}", {
    current: round.index + 1,
    total,
  });

  return (
    <TaskFrame
      exitHref={exitHref}
      exitToApp
      footer={
        <>
          {round.failed && <TaskSaveError onRetry={round.retryFinish} />}
          <WordActions
            available={mic.available}
            graded={graded}
            isLast={isLast}
            mic={mic.recorder}
            round={round}
          />
        </>
      }
      headerEnd={
        !graded &&
        mic.available && <WordMenu disabled={round.isPending || recording} onSkip={round.next} />
      }
      headerTitle={<TaskHeaderTitle title={t("Say it again")} />}
      progress={{
        label: position,
        segments: round.segments,
        value: ((round.index + (graded ? 1 : 0)) / total) * PERCENT,
      }}
    >
      <PronunciationWord key={current.id} language={reviews.language} word={current} />

      {graded ? (
        <GradeNote grade={graded} />
      ) : (
        <RecorderStatus
          available={mic.available}
          notice={notice}
          pending={round.isPending}
          recording={recording}
        />
      )}
    </TaskFrame>
  );
}

/**
 * The action bar's one row: Record (Stop while recording) before the word is graded, or Skip when
 * there's no microphone; once graded, Try again beside Continue when it didn't sound right.
 */
function WordActions({
  available,
  graded,
  isLast,
  mic,
  round,
}: {
  available: boolean;
  graded: PronunciationAnswerGrade | null;
  isLast: boolean;
  mic: ReturnType<typeof useWordRecorder>["recorder"];
  round: ReturnType<typeof usePronunciationRound>;
}) {
  const t = useExtracted();

  if (graded) {
    return (
      <TaskActions>
        {!graded.isCorrect && (
          <Button className="shrink-0" onClick={round.tryAgain} size="lg" variant="outline">
            <RotateCcwIcon aria-hidden="true" />
            {t("Try again")}
          </Button>
        )}
        <TaskMainButton busy={round.isPending} onClick={round.next}>
          {isLast ? t("See how it went") : t("Continue")}
        </TaskMainButton>
      </TaskActions>
    );
  }

  if (!available) {
    return (
      <TaskActions>
        <TaskMainButton busy={round.isPending} onClick={round.next}>
          {t("Skip this word")}
        </TaskMainButton>
      </TaskActions>
    );
  }

  return (
    <RecordButton
      className="w-full"
      disabled={round.isPending}
      elapsedMs={mic.elapsedMs}
      onStart={() => void mic.start()}
      onStop={mic.stop}
      recording={mic.status === "recording"}
    />
  );
}
