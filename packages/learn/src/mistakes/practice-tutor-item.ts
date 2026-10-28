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

  const answered = phase.kind === "feedback";

  if (step.entry.drill.timeLimitSeconds !== null && !answered) {
    return null;
  }

  return {
    answered,
    blockId: null,
    itemId: step.question.itemId,
    missed: phase.kind === "feedback" && !phase.feedback.isCorrect,
    position: state.index,
    text: step.question.question,
  };
}
