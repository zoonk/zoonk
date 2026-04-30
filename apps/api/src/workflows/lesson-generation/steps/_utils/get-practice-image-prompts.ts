import { type LessonPracticeSchema } from "@zoonk/ai/tasks/lessons/core/practice";

type PracticeScenario = LessonPracticeSchema["scenario"];
type PracticeStep = LessonPracticeSchema["steps"][number];

export function getPracticeImagePrompts({
  scenario,
  steps,
}: {
  scenario: PracticeScenario;
  steps: PracticeStep[];
}) {
  return [scenario.imagePrompt.trim(), ...steps.map((step) => step.imagePrompt.trim())];
}
