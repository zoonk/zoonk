import { answerKeyEvidence } from "@/lib/answer-key-evidence";
import { type PublishedAlphabetLesson } from "@zoonk/ai/tasks/language/alphabet-lesson";
import { buildAlphabetLessonSteps } from "@zoonk/core/library/language/alphabet-lesson-steps";

export function alphabetAnswerKeys({
  lesson,
  steps = buildAlphabetLessonSteps({ audioUrls: new Map(), content: lesson }),
}: {
  lesson: PublishedAlphabetLesson;
  steps?: ReturnType<typeof buildAlphabetLessonSteps>;
}) {
  return answerKeyEvidence((label) => ({
    lesson,
    matches: steps.flatMap((step, index) =>
      step.kind === "matchColumns" ? [label(step.content, `steps[${index}]`)] : [],
    ),
  }));
}
