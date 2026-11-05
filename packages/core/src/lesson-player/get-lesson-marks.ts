import "server-only";
import { type StepMarks } from "../library/marks/step-marks-contract";
import { getPlayableLibraryLesson } from "./get-playable-library-lesson";
import { type PlayableLibraryLesson } from "./playable-lesson";

export type LessonMarks = Pick<PlayableLibraryLesson, "marksPending" | "summary"> & {
  steps: { marks: StepMarks | null; stepId: string }[];
};

/**
 * What a player polls while `marksPending`: the lesson's marks and map as its next read has them,
 * for the learner's own version of each screen. Null when the lesson isn't playable for them.
 */
export async function getLessonMarks({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonMarks | null> {
  const result = await getPlayableLibraryLesson({ lessonId });

  if (result?.status !== "ready") {
    return null;
  }

  const { marksPending, steps, summary } = result.lesson;

  return {
    marksPending,
    steps: steps.flatMap((step) =>
      "marks" in step ? [{ marks: step.marks, stepId: step.id }] : [],
    ),
    summary,
  };
}
