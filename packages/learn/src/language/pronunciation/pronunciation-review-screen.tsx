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
import {
  BrainIcon,
  CheckCircle2Icon,
  EllipsisIcon,
  RotateCcwIcon,
  SkipForwardIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { TASK_HEADER_ICON_CLASS } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { MissionMoment } from "../../missions/mission-moment";
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
        <p className="text-success-text flex items-center gap-2 font-semibold">
          <CheckCircle2Icon aria-hidden="true" className="size-5" />
          {t("That sounded right")}
        </p>
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

/** The round's count in the mono face, as every count reads ("2/3"). */
function monoScore(chunks: React.ReactNode) {
  return <span className="font-mono tracking-[-0.03em] tabular-nums">{chunks}</span>;
}

/** "2/3 sounded right", as a pattern's drill counts its result; screen readers hear "2 of 3". */
function RoundScore({ result }: { result: PronunciationRoundResult }) {
  const t = useExtracted();
  const counts = { correct: result.correct, total: result.total };

  return (
    <>
      <span aria-hidden="true">
        {t.rich("<score>{correct, number}/{total, number}</score> sounded right", {
          ...counts,
          score: monoScore,
        })}
      </span>
      <span className="sr-only">
        {t("{correct, number} of {total, number} sounded right", counts)}
      </span>
    </>
  );
}

function RoundResult({ result }: { result: PronunciationRoundResult | null }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-3 py-6" role="status">
      <h1 className="text-title text-balance">
        {result ? <RoundScore result={result} /> : t("Nothing said this time")}
      </h1>

      {result && result.brainPower > 0 && (
        <FactChips>
          <FactChip>
            <BrainIcon aria-hidden="true" className="text-brain" />
            {t("+{points} Brain Power", { points: format.number(result.brainPower) })}
          </FactChip>
        </FactChips>
      )}

      <p className="text-muted-foreground text-pretty">
        {t("An accent never blocks you. Words that still sound different come back tomorrow.")}
      </p>

      {result?.missionMoment && (
        <MissionMoment
          completed={result.missionMoment.completed}
          fullMeal={result.missionMoment.fullMeal}
          missions={result.missionMoment.missions}
        />
      )}
    </div>
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
 * microphone). Nothing due shows a short note. Leaving goes back where the round was opened
 * (Today, a unit).
 *
 * ```tsx
 * <PronunciationReviewScreen actions={actions} exitHref="/today" reviews={reviews} />
 * ```
 */
export function PronunciationReviewScreen({
  actions,
  exitHref,
  reviews,
}: {
  actions: PronunciationRoundActions;
  exitHref: string;
  reviews: PronunciationReviewsView;
}) {
  const t = useExtracted();
  const round = usePronunciationRound({ actions, words: reviews.words });
  const mic = useWordRecorder(round.record);
  const { current, step } = round;
  const total = round.segments.length;

  if (step.kind === "result" || !current) {
    return (
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
        headerTitle={t("Say it again")}
      >
        {total === 0 ? (
          <p className="text-title py-6 text-balance" role="status">
            {t("No words to say again today.")}
          </p>
        ) : (
          <RoundResult result={step.kind === "result" ? step.result : null} />
        )}
      </TaskFrame>
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
      headerTitle={t("Say it again")}
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
        <TaskMainButton disabled={round.isPending} onClick={round.next}>
          {isLast ? t("See how it went") : t("Continue")}
        </TaskMainButton>
      </TaskActions>
    );
  }

  if (!available) {
    return (
      <TaskActions>
        <TaskMainButton disabled={round.isPending} onClick={round.next}>
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
