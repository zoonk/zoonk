import { type PracticeLessonContent } from "./generated-lesson-content";

type PracticeScenario = PracticeLessonContent["scenario"];
type PracticeStep = PracticeLessonContent["steps"][number];

export function getPracticeImagePrompts({
  scenario,
  steps,
}: {
  scenario: PracticeScenario;
  steps: PracticeStep[];
}) {
  return [scenario.imagePrompt.trim(), ...steps.map((step) => step.imagePrompt.trim())];
}
