import { type TutorItem } from "../questions/question-tutor";
import { type useMistakePractice } from "./use-mistake-practice";

type Run = ReturnType<typeof useMistakePractice>;

export function getPracticeTutorItem({
  state,
  step,
}: Pick<Run, "state" | "step">): TutorItem | null {
  const { phase } = state;

  if (!step || phase.kind === "idea" || phase.kind === "ending" || phase.kind === "ended") {
    return null;
  }

  if (!step.entry.tutorAvailable) {
    return null;
  }

  const answered = phase.kind === "feedback" && phase.feedback.lessonResult?.checked !== false;

  if (step.entry.drill.timeLimitSeconds !== null && !answered) {
    return null;
  }

  const answer = getTutorAnswer(phase);

  return {
    ...(step.lesson && {
      lesson: {
        answer,
        id: step.lesson.lessonId,
        mistakeId: step.entry.mistakeId,
        stepId: step.lesson.step.id,
      },
    }),
    answered,
    blockId: null,
    itemId: step.lesson?.step.id ?? step.question?.itemId ?? "",
    missed: answered && phase.kind === "feedback" && !phase.feedback.isCorrect,
    mistakeId: step.entry.mistakeId,
    position: state.index,
    text: step.lesson ? step.entry.snapshot.question : (step.question?.question ?? ""),
  };
}

function getTutorAnswer(phase: Run["state"]["phase"]) {
  if (phase.kind !== "feedback" || phase.feedback.lessonResult?.checked === false) {
    return null;
  }

  return "kind" in phase.answer ? phase.answer : null;
}
