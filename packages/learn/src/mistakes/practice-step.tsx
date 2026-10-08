"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button } from "@zoonk/ui/components/button";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { EnterButton } from "../_components/enter-button";
import { ChoiceQuestion } from "../questions/choice-question";
import { ItemLine, ItemSupport } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { DrillAnswerNotes } from "./drill/drill-answer-notes";
import { NotSureButton, ShowAnswersButton } from "./drill/drill-controls";
import { DrillCountdown } from "./drill/drill-countdown";
import { DrillIntro } from "./drill/drill-intro";
import { type LessonHref, isIdeaFirst, isReadFirst } from "./drill/drill-types";
import { type PracticeStep as Step } from "./mistake-practice-state";
import { type useMistakePractice } from "./use-mistake-practice";

type Run = ReturnType<typeof useMistakePractice>;

/** The step's main action: Check the picked answer, then Continue, both on Enter too. */
function MainButton({ run }: { run: Run }) {
  const t = useExtracted();
  const { phase } = run.state;
  const selected = phase.kind === "answering" ? phase.selected : null;
  const retry = phase.kind === "answerFailed" ? phase.answer : null;
  const answer = selected ?? retry;

  const act = phase.kind === "feedback" ? run.next : () => (answer ? run.check(answer) : false);

  useEnterKey(act, { enabled: phase.kind === "feedback" || answer !== null });

  return (
    <EnterButton
      className="sm:flex-1"
      disabled={phase.kind === "checking" || (phase.kind !== "feedback" && !answer)}
      onClick={act}
    >
      {phase.kind === "feedback" ? t("Continue") : t("Check")}
    </EnterButton>
  );
}

function StepActions({ run, step }: { run: Run; step: Step }) {
  const t = useExtracted();
  const { phase } = run.state;
  const noGuessing = step.entry.drill.kind === "noGuessing";

  return (
    <div className="flex flex-col gap-2 sm:flex-row-reverse">
      <MainButton run={run} />
      {phase.kind !== "feedback" &&
        (noGuessing ? (
          <NotSureButton disabled={phase.kind === "checking"} onClick={run.notSure} />
        ) : (
          <Button
            className="h-12 rounded-full"
            disabled={phase.kind === "checking"}
            onClick={run.notSure}
            size="lg"
            variant="ghost"
          >
            {t("I don't know yet")}
          </Button>
        ))}
    </div>
  );
}

/** A misread's question on its own, before its answers show. */
function ReadingQuestion({ question }: { question: Step["question"] }) {
  return (
    <div className="flex flex-col gap-4">
      <ItemSupport
        className="text-muted-foreground text-sm"
        context={question.context}
        image={question.image}
        visual={question.visual}
      />
      <h2 className="text-lg font-medium">
        <ItemLine text={question.question} />
      </h2>
    </div>
  );
}

function AnswerFailed() {
  const t = useExtracted();

  return (
    <p className="text-destructive text-sm" role="alert">
      {t("We couldn't save that answer. Check it again.")}
    </p>
  );
}

/**
 * One question of the run, played by its drill: the idea first for a content gap, the question
 * before its answers for a misread, a clock for a timed drill, "I'm not sure" when guessing is the
 * habit, and the trap named after the answer in a trap drill.
 */
export function PracticeStepView({
  lessonHref,
  run,
  step,
  trueFalseLabels,
}: {
  lessonHref: LessonHref | null;
  run: Run;
  step: Step;
  trueFalseLabels: TrueFalseLabels;
}) {
  const { answerText } = useTrueFalseLabels(trueFalseLabels);
  const { phase } = run.state;
  const { drill } = step.entry;

  // The earlier answer belongs to the mistake's own question; next to another one it misleads.
  const lastAnswer =
    step.question.question === step.entry.snapshot.question
      ? answerText(step.entry.snapshot.answer)
      : null;

  if (phase.kind === "idea") {
    return (
      <DrillIntro
        drill={drill}
        lastAnswer={lastAnswer}
        lessonHref={lessonHref}
        onStart={run.start}
      />
    );
  }

  const feedback = phase.kind === "feedback" ? phase.feedback : null;
  const answered = "answer" in phase ? phase.answer : null;
  const selected = phase.kind === "answering" ? phase.selected : answered;

  return (
    <div className="flex flex-col gap-6">
      {/* A gap's idea had its own screen; other drills say how they work above their first
          question, and a misread above each one, since each waits behind "Show the answers". */}
      {!isIdeaFirst(drill) && (step.firstOfEntry || isReadFirst(drill)) && (
        <DrillIntro
          drill={drill}
          lastAnswer={step.firstOfEntry ? lastAnswer : null}
          lessonHref={lessonHref}
        />
      )}

      {drill.timeLimitSeconds !== null && phase.kind === "answering" && (
        <DrillCountdown
          key={step.question.itemId}
          onTimeUp={run.timeUp}
          seconds={drill.timeLimitSeconds}
        />
      )}

      {phase.kind === "reading" ? (
        <>
          <ReadingQuestion question={step.question} />
          <ShowAnswersButton onReveal={run.reveal} />
        </>
      ) : (
        <>
          <ChoiceQuestion
            disabled={phase.kind === "checking"}
            feedback={feedback}
            onSelect={run.select}
            question={step.question}
            selected={selected}
            trueFalseLabels={trueFalseLabels}
          />

          {phase.kind === "feedback" && (
            <DrillAnswerNotes
              drill={drill}
              notSure={answered !== null && "dontKnow" in answered}
              timedOut={phase.timedOut}
              trap={phase.feedback.trap}
            />
          )}

          {phase.kind === "answerFailed" && <AnswerFailed />}
          <StepActions run={run} step={step} />
        </>
      )}
    </div>
  );
}
