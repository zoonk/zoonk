import { type PracticeLessonContent } from "./generated-lesson-content";

type PracticeStep = PracticeLessonContent["steps"][number];

export function getPracticeImagePrompts({ steps }: { steps: PracticeStep[] }) {
  return steps.map((step) => step.imagePrompt.trim());
}
