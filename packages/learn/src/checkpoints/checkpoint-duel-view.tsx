"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { TaskHeaderTitle } from "../_components/task-header";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemLine, ItemSupport } from "../questions/item-text";
import { NumericAnswerField } from "../questions/numeric-answer-field";
import { TypedAnswerField } from "../questions/typed-answer-field";
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

/** How the question is answered: a number, a few typed words, or one option. */
function DuelAnswer({
  question,
  verdict,
}: {
  question: CheckpointQuestion;
  verdict: { isCorrect: boolean } | null;
}) {
  const { duel } = useCheckpointScreen();
  const { feedback, pending, selected } = duel.state;
  const locked = verdict !== null || pending;

  if (question.format === "numeric") {
    return (
      <NumericAnswerField
        locked={locked}
        onChange={(number) => duel.select(number === null ? null : { number })}
        onSubmit={() => void duel.confirm()}
        result={getVerdictResult(verdict)}
        unit={question.unit}
      />
    );
  }

  if (question.format === "typed") {
    return (
      <TypedAnswerField
        locked={locked}
        onChange={(text) => duel.select(text ? { text } : null)}
        onSubmit={() => void duel.confirm()}
        result={getVerdictResult(verdict)}
      />
    );
  }

  return (
    <CheckpointOptions
      onSelect={duel.select}
      question={question}
      selected={feedback?.itemId === question.itemId ? feedback.answer : selected}
      verdict={verdict}
    />
  );
}

function QuestionCard({ question }: { question: CheckpointQuestion }) {
  const { duel } = useCheckpointScreen();
  const { feedback } = duel.state;
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

      <DuelAnswer question={question} verdict={verdict} />
      {verdict && <Verdict isCorrect={verdict.isCorrect} />}
    </div>
  );
}

/**
 * A listening phase's recording above its questions, played as strictly as a mock: every play
 * counts, a reload's too. Keyed by its set, it keeps playing while the learner answers along, and
 * once its last question is answered it plays freely with its transcript.
 */
function DuelRecording({ question }: { question: CheckpointQuestion }) {
  const { checkpoint, duel } = useCheckpointScreen();
  const { set } = question;

  if (!set?.listening) {
    return null;
  }

  const onRecording = checkpoint.questions.filter((other) => other.set?.id === set.id);

  return (
    <ItemSetStimulus
      askedIn={checkpoint.blockId}
      key={set.id}
      questions={{
        current: onRecording.findIndex((other) => other.itemId === question.itemId),
        prompts: onRecording.map((other) => other.question),
      }}
      set={set}
      transcript={duel.state.transcripts[set.id] ?? null}
    />
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
      {question && <DuelRecording question={question} />}
      {question && <QuestionCard key={question.itemId} question={question} />}
    </CheckpointFrame>
  );
}
