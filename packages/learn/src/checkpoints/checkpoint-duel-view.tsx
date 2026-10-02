"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useLocale } from "next-intl";
import { useExperienceMode } from "../mode-provider";
import { ItemLine, ItemText } from "../questions/item-text";
import { NumericAnswerField } from "../questions/numeric-answer-field";
import { TaskMainButton } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";
import { getCurrentQuestion, getDuelScore } from "./checkpoint-duel-state";
import { CheckpointError, CheckpointFrame } from "./checkpoint-frame";
import { CheckpointOptions } from "./checkpoint-options";
import { TricksterShield } from "./trickster-shield";
import { useTricksterLine } from "./use-trickster-line";

const PERCENT = 100;

function useDuelNumbers() {
  const { checkpoint, duel } = useCheckpointScreen();
  const score = getDuelScore({ checkpoint, state: duel.state });
  const question = getCurrentQuestion({ checkpoint, state: duel.state });

  const position = question
    ? checkpoint.questions.findIndex((candidate) => candidate.itemId === question.itemId)
    : checkpoint.questions.length - 1;

  return { position, question, score, total: checkpoint.questions.length };
}

/** The Trickster, his shield and his line. Each right answer cracks one segment. */
function TricksterBar() {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const { position, score } = useDuelNumbers();
  const toGo = Math.max(0, checkpoint.passMark - score.correct);
  const line = useTricksterLine({ feedback: duel.state.feedback, position });

  return (
    <section aria-label={t("The Trickster")} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Trickster className="size-14 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-fun-display font-semibold">{t("The Trickster")}</span>
            <span className="text-fun-fg2 text-xs tabular-nums" aria-live="polite">
              {toGo > 0
                ? t("{correct} right · {toGo} to go", {
                    correct: String(score.correct),
                    toGo: String(toGo),
                  })
                : t("Shield broken!")}
            </span>
          </div>
          <TricksterShield cracked={score.correct} segments={checkpoint.passMark} />
        </div>
      </div>
      <p className="fun-glass self-center rounded-full px-4 py-1.5 text-center text-sm">{line}</p>
    </section>
  );
}

function Verdict({ isCorrect }: { isCorrect: boolean }) {
  const t = useExtracted();
  const mode = useExperienceMode();

  return (
    <p
      className={cn(
        "text-center font-semibold",
        mode === "fun" && "font-fun-display animate-fun-flip-calm",
        isCorrect ? "text-success" : "text-muted-foreground",
      )}
      role="status"
    >
      {isCorrect ? t("Right!") : t("Not this one. You'll see why at the end.")}
    </p>
  );
}

function getVerdictResult(verdict: { isCorrect: boolean } | null) {
  if (!verdict) {
    return null;
  }

  return verdict.isCorrect ? "correct" : "wrong";
}

function QuestionCard({ question }: { question: CheckpointQuestion }) {
  const t = useExtracted();
  const { duel } = useCheckpointScreen();
  const { feedback, selected } = duel.state;
  const verdict = feedback?.itemId === question.itemId ? { isCorrect: feedback.isCorrect } : null;

  return (
    <div
      className="in-data-[mode=fun]:fun-paper flex flex-col gap-4 in-data-[mode=fun]:rounded-[28px] in-data-[mode=fun]:p-5"
      data-slot="checkpoint-question"
    >
      <span className="bg-muted text-muted-foreground self-start rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.12em] uppercase">
        {t("No hints")}
      </span>

      {question.context && <ItemText className="text-muted-foreground" text={question.context} />}
      <h1 className="text-lg leading-snug font-semibold text-balance sm:text-xl">
        <ItemLine text={question.question} />
      </h1>

      {question.format === "numeric" ? (
        <NumericAnswerField
          locked={verdict !== null || duel.state.pending}
          onChange={(number) => duel.select(number === null ? null : { number })}
          onSubmit={() => void duel.confirm()}
          result={getVerdictResult(verdict)}
          unit={question.unit}
        />
      ) : (
        <CheckpointOptions
          onSelect={duel.select}
          question={question}
          selected={feedback?.itemId === question.itemId ? feedback.answer : selected}
          verdict={verdict}
        />
      )}

      {verdict && <Verdict isCorrect={verdict.isCorrect} />}
    </div>
  );
}

function DuelAction() {
  const t = useExtracted();
  const { duel } = useCheckpointScreen();
  const { question, score } = useDuelNumbers();
  const { feedback, pending, selected } = duel.state;

  if (!question || feedback) {
    const isLast = score.done;

    return (
      <TaskMainButton disabled={pending} onClick={() => void duel.next()}>
        {isLast ? t("See how it went") : t("Next")}
      </TaskMainButton>
    );
  }

  return (
    <TaskMainButton disabled={pending || !selected} onClick={() => void duel.confirm()}>
      {t("Confirm")}
    </TaskMainButton>
  );
}

/**
 * One question at a time, without hints: right or wrong shows after each answer, and the answers
 * and the traps wait for the end. Fun draws the Trickster's shield; Focus a thin progress bar.
 */
export function CheckpointDuelView() {
  const t = useExtracted();
  const locale = useLocale();
  const mode = useExperienceMode();
  const { checkpoint } = useCheckpointScreen();
  const { position, question, score, total } = useDuelNumbers();
  const isBoss = checkpoint.kind !== "weekly";

  return (
    <CheckpointFrame
      footer={
        <>
          <CheckpointError />
          <DuelAction />
        </>
      }
      headerTitle={t("Question {current} of {total}", {
        current: String(Math.min(position + 1, total)),
        total: String(total),
      })}
    >
      {mode === "fun" && isBoss ? (
        <TricksterBar />
      ) : (
        <ProgressRoot
          locale={locale}
          aria-label={t("Questions answered")}
          value={total > 0 ? (score.answered / total) * PERCENT : 0}
        >
          <ProgressTrack className="h-1">
            <ProgressIndicator className="in-data-[mode=fun]:bg-fun-accent-lime" />
          </ProgressTrack>
        </ProgressRoot>
      )}

      {question && <QuestionCard key={question.itemId} question={question} />}
    </CheckpointFrame>
  );
}
