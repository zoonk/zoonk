"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import { TaskAside, TaskAsideSection } from "../_components/task-layout";
import { ItemLine, ItemStem } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { LessonLink } from "./drill/drill-intro";
import { type LessonHref } from "./drill/drill-types";
import { useDrillLine } from "./drill/use-drill-line";
import { MistakeAnswer, MistakeCauseLabel } from "./mistake-entry";
import { type PracticeStep, isMistakeQuestion } from "./mistake-practice-state";
import { MistakeStimulus } from "./mistake-stimulus";

/**
 * The mistake as the learner made it: why it happened (and once a right answer here fixed it, that
 * it's fixed), the question it was made on (unless that's the question in view; a content gap's
 * idea screen has none in view yet) and what they answered. Never the right answer: the question
 * is asked again.
 */
function LastTime({
  fixed,
  questionInView,
  step,
  trueFalseLabels,
}: {
  fixed: boolean;
  questionInView: boolean;
  step: PracticeStep;
  trueFalseLabels: TrueFalseLabels;
}) {
  const { answerText } = useTrueFalseLabels(trueFalseLabels);
  const { cause, snapshot } = step.entry;
  const answer = answerText(snapshot.answer);

  const showsQuestion = snapshot.question !== "" && !(questionInView && isMistakeQuestion(step));
  /** Recording review reveals the answers; the next question plays it with the drill's limits. */
  const stimulus = { ...snapshot, set: snapshot.set?.kind === "audio" ? null : snapshot.set };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {cause && <MistakeCauseLabel cause={cause} fixed={fixed} />}

      {showsQuestion && (
        <>
          <MistakeStimulus snapshot={stimulus} />
          <div className="leading-snug font-medium">
            <ItemStem text={snapshot.question} />
          </div>
        </>
      )}

      {answer && (
        <MistakeAnswer kind="learner">
          <ItemLine text={answer} />
        </MistakeAnswer>
      )}
    </div>
  );
}

/**
 * How this practice goes about the mistake: its drill's rule (a plain retry has none to say), the
 * lesson a content gap goes back to, and what fixes it, until it's fixed. The rule and what fixes
 * it are for answering, so once the question in view is graded (`answered`) only the lesson stays.
 */
function ThisTime({
  answered,
  fixed,
  lessonHref,
  step,
}: {
  answered: boolean;
  fixed: boolean;
  lessonHref: LessonHref | null;
  step: PracticeStep;
}) {
  const t = useExtracted();
  const drillLine = useDrillLine();
  const { drill } = step.entry;
  const lesson = drill.kind === "reteach" ? drill.lesson : null;

  return (
    <div className="flex flex-col items-start gap-3 text-sm">
      {!answered && drill.kind !== "retry" && <p className="text-pretty">{drillLine(drill)}</p>}
      {lesson && lessonHref && <LessonLink lesson={lesson} lessonHref={lessonHref} />}
      {!answered && !fixed && (
        <p className="text-muted-foreground text-xs">{t("One right answer fixes it.")}</p>
      )}
    </div>
  );
}

/**
 * Practice's aside from `lg`, beside the question: "Last time" (the mistake as it was made) and
 * "This time" (how the drill goes and what fixes it) for the mistake the question in view drills,
 * which of the run's mistakes it is, and the learner's buddy at its foot (`tutor`). The column
 * keeps only the question: under `lg` the drill's note says the same above it. On a content gap's
 * idea screen the column already says how the drill goes, so "This time" waits for the questions,
 * and once the question is graded it keeps only the lesson to go over, if there is one.
 */
export function PracticeAside({
  answered,
  fixed,
  lessonHref,
  position,
  showsDrill,
  step,
  trueFalseLabels,
  tutor,
}: {
  /** Whether the question in view is graded. */
  answered: boolean;
  /** Whether a right answer in this run fixed the mistake. */
  fixed: boolean;
  lessonHref: LessonHref | null;
  position: { current: number; total: number };
  /** False on a content gap's idea screen, before its questions. */
  showsDrill: boolean;
  step: PracticeStep;
  trueFalseLabels: TrueFalseLabels;
  tutor: React.ReactNode;
}) {
  const t = useExtracted();
  const { cause, drill, snapshot } = step.entry;
  const hasLastTime = Boolean(cause || snapshot.answer);
  const hasLesson = drill.kind === "reteach" && Boolean(drill.lesson && lessonHref);
  const hasThisTime = showsDrill && (!answered || hasLesson);
  const title = hasLastTime ? t("Last time") : t("This time");

  const thisTime = (
    <ThisTime answered={answered} fixed={fixed} lessonHref={lessonHref} step={step} />
  );

  return (
    <TaskAside
      label={t("Help with this question")}
      meta={
        position.total > 1 ? t("Mistake {current, number} of {total, number}", position) : undefined
      }
      title={hasLastTime || hasThisTime ? title : undefined}
    >
      <div className="flex flex-col gap-8 pb-(--task-aside-bottom)">
        {hasLastTime && (
          <LastTime
            fixed={fixed}
            questionInView={showsDrill}
            step={step}
            trueFalseLabels={trueFalseLabels}
          />
        )}

        {hasThisTime && hasLastTime && (
          <TaskAsideSection title={t("This time")}>{thisTime}</TaskAsideSection>
        )}

        {hasThisTime && !hasLastTime && thisTime}
      </div>

      {tutor}
    </TaskAside>
  );
}
