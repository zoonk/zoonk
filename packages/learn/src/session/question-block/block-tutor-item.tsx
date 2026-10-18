import { type QuestionTutor, type TutorItem } from "../../questions/question-tutor";
import { type TaskFrameAside } from "../../shell/task-frame";
import { type StudyBlockDetail, type StudyQuestion } from "../session-types";
import { type useBlockDrill } from "./block-question";
import { type QuestionBlockPhase } from "./question-block-state";

/**
 * The block's question in view as the buddy is asked about it; none on a gap's idea screen, for a
 * placement question (a diagnostic the learner answers alone) and while a timed drill's clock runs.
 */
export function getBlockTutorItem({
  blockDrill,
  detail,
  phase,
  question,
}: {
  blockDrill: Pick<ReturnType<typeof useBlockDrill>, "drill" | "stage">;
  detail: StudyBlockDetail;
  phase: QuestionBlockPhase;
  question: StudyQuestion | null;
}): TutorItem | null {
  const answered = phase.kind === "feedback";
  const timed = blockDrill.drill !== null && blockDrill.drill.timeLimitSeconds !== null;

  if (!question || question.placement || blockDrill.stage === "idea" || (timed && !answered)) {
    return null;
  }

  return {
    answered,
    blockId: detail.block.id,
    itemId: question.itemId,
    missed: phase.kind === "feedback" && !phase.feedback.isCorrect,
    text: question.question,
  };
}

/** The block's aside with the buddy docked at its foot, when the host has one. */
export function withTutorAside({
  aside,
  tutor,
}: {
  aside: TaskFrameAside;
  tutor: QuestionTutor | null | undefined;
}): TaskFrameAside {
  if (!tutor) {
    return aside;
  }

  return {
    ...aside,
    children: (
      <>
        {aside.children}
        {tutor.aside}
      </>
    ),
  };
}
