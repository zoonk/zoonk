"use client";

import {
  type PronunciationAnswerGrade,
  type PronunciationReviewsView,
  type PronunciationRoundResult,
} from "@zoonk/core/language/pronunciation/contract";
import { Button } from "@zoonk/ui/components/button";
import { CheckCircle2Icon, MicIcon, RotateCcwIcon, ZapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { KindTile } from "../../_components/kind-tile";
import { TaskFrame, TaskMainButton, TaskMainLink, TaskSaveError } from "../../shell/task-frame";
import { PronunciationRecorder, PronunciationWordCard } from "./pronunciation-word-card";
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
    <div aria-live="polite" className="flex flex-col items-center gap-1 text-center" role="status">
      {grade.isCorrect ? (
        <p className="text-success flex items-center gap-2 font-semibold">
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

function RoundResult({ result }: { result: PronunciationRoundResult | null }) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <div
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center lg:flex-none"
      role="status"
    >
      <KindTile icon={MicIcon} kind="conversation" size="lg" />
      <h1 className="text-3xl font-bold tracking-tight text-balance tabular-nums">
        {result
          ? t("{correct, number} of {total, number} sounded right", {
              correct: result.correct,
              total: result.total,
            })
          : t("Nothing said this time")}
      </h1>

      {result && result.brainPower > 0 && (
        <FactChips className="justify-center">
          <FactChip>
            <ZapIcon aria-hidden="true" />
            {t("+{points} Brain Power", { points: format.number(result.brainPower) })}
          </FactChip>
        </FactChips>
      )}

      <p className="text-muted-foreground max-w-sm">
        {t("An accent never blocks you. Words that still sound different come back tomorrow.")}
      </p>
    </div>
  );
}

/**
 * Pronunciation reviews, full screen: each word the learner mispronounced comes
 * back with its native sound, a slow version, the respelling and the tip; they say it, see what we
 * heard, and the round counts toward their day at the end. Nothing due shows a short note.
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
  const { current, step } = round;
  const total = reviews.words.length;

  if (step.kind === "result" || !current) {
    return (
      <TaskFrame
        exitHref={exitHref}
        footer={<TaskMainLink href={exitHref}>{t("Back to Today")}</TaskMainLink>}
        headerTitle={t("Say it again")}
      >
        {total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center lg:flex-none">
            <KindTile icon={MicIcon} kind="conversation" size="lg" />
            <p className="text-2xl font-bold tracking-tight text-balance" role="status">
              {t("No words to say again today.")}
            </p>
          </div>
        ) : (
          <RoundResult result={step.kind === "result" ? step.result : null} />
        )}
      </TaskFrame>
    );
  }

  const graded = step.word.kind === "graded" ? step.word.grade : null;
  const notice = step.word.kind === "ready" ? step.word.notice : null;
  const isLast = round.index + 1 === total;

  const title = t("Word {current, number} of {total, number}", { current: round.index + 1, total });

  return (
    <TaskFrame
      exitHref={exitHref}
      footer={
        <>
          {round.failed && <TaskSaveError onRetry={round.retryFinish} />}
          {graded && !graded.isCorrect && (
            <Button
              className="w-full"
              onClick={round.tryAgain}
              size="xl"
              type="button"
              variant="secondary"
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("Try once more")}
            </Button>
          )}
          {graded ? (
            <TaskMainButton disabled={round.isPending} onClick={round.next}>
              {isLast ? t("See how it went") : t("Continue")}
            </TaskMainButton>
          ) : (
            <Button
              className="w-full"
              disabled={round.isPending}
              onClick={round.next}
              size="xl"
              type="button"
              variant="ghost"
            >
              {t("Skip this word")}
            </Button>
          )}
        </>
      }
      headerTitle={title}
      progress={{ label: title, value: ((round.index + (graded ? 1 : 0)) / total) * PERCENT }}
    >
      <PronunciationWordCard key={current.id} language={reviews.language} word={current} />

      {graded ? (
        <GradeNote grade={graded} />
      ) : (
        <PronunciationRecorder
          notice={notice}
          onRecorded={round.record}
          pending={round.isPending}
        />
      )}
    </TaskFrame>
  );
}
