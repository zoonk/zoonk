"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { TaskHeaderTitle } from "../_components/task-header";
import { ItemLine, ItemSupport } from "../questions/item-text";
import { NumericAnswerField } from "../questions/numeric-answer-field";
import { TaskMainButton } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";
import { getCurrentQuestion, getDuelScore } from "./checkpoint-duel-state";
import { CheckpointError, CheckpointFrame } from "./checkpoint-frame";
import { CheckpointOptions } from "./checkpoint-options";
import { TricksterShield } from "./trickster-shield";

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

function Verdict({ isCorrect }: { isCorrect: boolean }) {
  const t = useExtracted();

  return (
    <p
      className={cn(
        "text-center font-semibold",
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
  const { duel } = useCheckpointScreen();
  const { feedback, selected } = duel.state;
  const verdict = feedback?.itemId === question.itemId ? { isCorrect: feedback.isCorrect } : null;

  return (
    <div className="flex flex-col gap-4" data-slot="checkpoint-question">
      <ItemSupport
        className="text-muted-foreground"
        context={question.context}
        image={question.image}
        visual={question.visual}
      />
      <h2 className="text-lg leading-snug font-semibold text-balance sm:text-xl">
        <ItemLine text={question.question} />
      </h2>

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
 * and the traps wait for the end. Against the Trickster, his shield is the duel's one bar: each
 * right answer breaks a segment. The weekly challenge has a plain bar of questions answered.
 */
export function CheckpointDuelView() {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const { position, question, score, total } = useDuelNumbers();
  const isBoss = checkpoint.kind !== "weekly";
  const current = String(Math.min(position + 1, total));

  return (
    <CheckpointFrame
      footer={
        <>
          <CheckpointError />
          <DuelAction />
        </>
      }
      headerTitle={
        <TaskHeaderTitle
          detail={t("Question {current} of {total}", { current, total: String(total) })}
          title={isBoss ? t("The Trickster") : t("Weekly challenge")}
        />
      }
      progress={
        isBoss
          ? undefined
          : {
              label: t("Questions answered"),
              value: total > 0 ? (score.answered / total) * PERCENT : 0,
            }
      }
    >
      {isBoss && <TricksterShield broken={score.correct} segments={checkpoint.passMark} />}
      {question && <QuestionCard key={question.itemId} question={question} />}
    </CheckpointFrame>
  );
}
