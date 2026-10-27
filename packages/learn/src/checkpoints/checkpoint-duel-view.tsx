"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { BrainIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { TaskHeaderSegments, TaskHeaderTitle, type TaskSegment } from "../_components/task-header";
import { TaskActions } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemStem, ItemSupport, QUESTION_TEXT_CLASS } from "../questions/item-text";
import { NumericAnswerField } from "../questions/numeric-answer-field";
import { TypedAnswerField } from "../questions/typed-answer-field";
import { type TaskFrameAside, TaskMainButton } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";
import { getCurrentQuestion, getDuelScore } from "./checkpoint-duel-state";
import { DuelOver, Verdict } from "./checkpoint-duel-verdict";
import { NoVerdictStep } from "./checkpoint-empty";
import { CheckpointError, CheckpointFrame } from "./checkpoint-frame";
import { phaseNumber, useCheckpointEyebrow } from "./checkpoint-labels";
import { CheckpointOptions } from "./checkpoint-options";
import { TricksterArt } from "./trickster-art";
import { TricksterShield, TricksterShieldPlates } from "./trickster-shield";
import { useVerdictReactions } from "./use-verdict-reactions";

const PERCENT = 100;

function useDuelNumbers() {
  const { checkpoint, duel } = useCheckpointScreen();
  const score = getDuelScore({ checkpoint, state: duel.state });
  const question = getCurrentQuestion({ checkpoint, state: duel.state });

  const visibleIds = new Set(checkpoint.questions.map((candidate) => candidate.itemId));
  const removedVerdicts = Object.entries(duel.state.verdicts).filter(([id]) => !visibleIds.has(id));

  // Without a question on screen the duel is over: the last one answered stays the place.
  const position = question
    ? removedVerdicts.length +
      checkpoint.questions.findIndex((candidate) => candidate.itemId === question.itemId)
    : score.answered - 1;

  // Each question's segment: blue or red once it has its verdict, the one in view, the rest ahead.
  const visibleSegments = checkpoint.questions.map((candidate, index): TaskSegment => {
    const verdict = duel.state.verdicts[candidate.itemId];

    if (verdict !== undefined) {
      return verdict ? "right" : "wrong";
    }

    return index + removedVerdicts.length === position ? "current" : "ahead";
  });

  const segments: TaskSegment[] = [
    ...removedVerdicts.map(([, correct]): TaskSegment => (correct ? "right" : "wrong")),
    ...visibleSegments,
  ];

  return { position, question, score, segments, total: score.questions };
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
      locked={pending}
      onSelect={duel.select}
      question={question}
      selected={feedback?.itemId === question.itemId ? feedback.answer : selected}
      verdict={verdict}
    />
  );
}

function QuestionCard({ question }: { question: CheckpointQuestion }) {
  const { checkpoint, duel } = useCheckpointScreen();
  const { feedback } = duel.state;
  const verdict = feedback?.itemId === question.itemId ? { isCorrect: feedback.isCorrect } : null;
  const { decision } = getDuelScore({ checkpoint, state: duel.state });

  return (
    <div className="flex flex-col gap-4" data-slot="checkpoint-question">
      <ItemSupport context={question.context} image={question.image} visual={question.visual} />
      <div className={QUESTION_TEXT_CLASS}>
        <ItemStem text={question.question} heading="h2" />
      </div>

      <DuelAnswer question={question} verdict={verdict} />
      {verdict && <Verdict decision={decision} isCorrect={verdict.isCorrect} />}
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
      <TaskMainButton busy={pending} onClick={() => void duel.next()}>
        {isLast ? t("See how it went") : t("Next")}
      </TaskMainButton>
    );
  }

  return (
    <TaskMainButton busy={pending} disabled={!selected} onClick={() => void duel.confirm()}>
      {t("Confirm")}
    </TaskMainButton>
  );
}

/** A prize's Brain Power, in its violet. */
function reward(chunks: React.ReactNode) {
  return <span className="text-brain-text">{chunks}</span>;
}

/**
 * What winning (or finishing the week's challenge) is worth, as one row: "+300 · phase 1 done",
 * its Brain Power in violet, as every reward amount reads, offered or earned.
 */
function PrizeRow() {
  const t = useExtracted();
  const format = useFormatter();
  const { checkpoint } = useCheckpointScreen();
  const points = format.number(checkpoint.reward.brainPower);
  const phase = phaseNumber(checkpoint);
  const isWeekly = checkpoint.kind === "weekly";

  const value =
    phase && checkpoint.reward.phaseComplete
      ? t.rich("<reward>+{points}</reward> · phase {phase} done", { phase, points, reward })
      : reward(t("+{points}", { points }));

  return (
    <StepRows>
      <StepRow>
        <BrainIcon aria-hidden="true" />
        <span className="min-w-0 flex-1 font-medium">
          {isWeekly ? t("Finishing") : t("Winning")}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {value}
        </span>
      </StepRow>
    </StepRows>
  );
}

/**
 * The opponent beside the question on wide screens: his face, reacting to each answer, his shield
 * as plates with where it stands ("2 broken · 3 to go · 3 questions left", just "7 broken" once the
 * duel is decided, since nothing more is asked), the duel's one rule and what winning pays, until it
 * can't be won.
 */
function TricksterPanel() {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const { score, total } = useDuelNumbers();
  const trickster = useVerdictReactions();
  const broken = Math.min(score.correct, checkpoint.passMark);
  const toGo = checkpoint.passMark - broken;

  return (
    <>
      <div className="flex flex-col gap-4">
        <TricksterArt className="size-26 sm:size-26" ref={trickster} />

        <section className="flex flex-col gap-3">
          <h3 className="text-[0.9375rem] font-[560]">{t("The Trickster's shield")}</h3>
          <TricksterShieldPlates broken={score.correct} segments={checkpoint.passMark} />
          <TaskMeta
            facts={[
              t("{count, plural, =0 {# broken} one {# broken} other {# broken}}", {
                count: broken,
              }),
              !score.decision &&
                toGo > 0 &&
                t("{count, plural, one {# to go} other {# to go}}", { count: toGo }),
              !score.decision &&
                t(
                  "{count, plural, =0 {No questions left} one {# question left} other {# questions left}}",
                  { count: total - score.answered },
                ),
            ]}
          />
        </section>

        <p className="text-muted-foreground text-[0.8125rem] leading-5 text-pretty">
          {t(
            "No hints. You'll see right or wrong after each answer, and why at the end, with the traps he set.",
          )}
        </p>
      </div>

      {score.decision !== "lost" && <PrizeRow />}
    </>
  );
}

/** The week's challenge beside its question on wide screens: its one rule and what finishing pays. */
function WeeklyPanel() {
  const t = useExtracted();

  return (
    <>
      <p className="text-muted-foreground text-[0.8125rem] leading-5 text-pretty">
        {t("No hints. You'll see right or wrong after each answer, and why at the end.")}
      </p>

      <PrizeRow />
    </>
  );
}

/**
 * What helps beside the duel from `lg`: the Trickster (or the week's rule and prize), under the
 * challenge's name with what winning takes. Phones keep his shield in the header instead.
 */
function useDuelAside(): TaskFrameAside {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const name = useCheckpointEyebrow(checkpoint);
  const isBoss = checkpoint.kind !== "weekly";

  return {
    children: isBoss ? <TricksterPanel /> : <WeeklyPanel />,
    label: name,
    meta: isBoss
      ? t("{count, plural, one {# right to win} other {# right to win}}", {
          count: checkpoint.passMark,
        })
      : null,
    title: name,
  };
}

/**
 * One question at a time, without hints: right or wrong shows after each answer, and the answers
 * and the traps wait for the end. Every duel fills one segment per question under its header,
 * blue or red, like every task's; against the Trickster a phone shows his shield there instead,
 * breaking a piece for each right answer, while a wide screen shows it beside the question.
 */
export function CheckpointDuelView() {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const { position, question, score, segments, total } = useDuelNumbers();
  const aside = useDuelAside();
  const isBoss = checkpoint.kind !== "weekly";
  const empty = total === 0;
  const current = Math.min(position + 1, total);
  const label = t("Question {current, number} of {total, number}", { current, total });
  const value = total > 0 ? (score.answered / total) * PERCENT : 0;

  // Only one of the two shows at a time, so screen readers hear one progress bar.
  const shieldThenQuestions = (
    <>
      <TricksterShield
        broken={score.correct}
        className="lg:hidden"
        held={score.decision === "lost"}
        label={label}
        segments={checkpoint.passMark}
        value={value}
      />
      <div className="max-lg:hidden">
        <TaskHeaderSegments label={label} segments={segments} value={value} />
      </div>
    </>
  );

  const progress = isBoss ? { bar: shieldThenQuestions } : { label, segments, value };

  return (
    <CheckpointFrame
      aside={empty ? null : aside}
      footer={
        <>
          <CheckpointError />
          <TaskActions>
            <DuelAction />
          </TaskActions>
        </>
      }
      headerTitle={<TaskHeaderTitle title={isBoss ? t("The Trickster") : t("Weekly challenge")} />}
      progress={empty ? undefined : progress}
    >
      {question && <DuelRecording question={question} />}
      {question && <QuestionCard key={question.itemId} question={question} />}
      {!question && (empty ? <NoVerdictStep /> : <DuelOver />)}
    </CheckpointFrame>
  );
}
