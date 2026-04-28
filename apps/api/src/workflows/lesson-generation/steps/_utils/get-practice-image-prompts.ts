import { type LessonPracticeSchema } from "@zoonk/ai/tasks/lessons/core/practice";

type PracticeScenario = LessonPracticeSchema["scenario"];
type PracticeStep = LessonPracticeSchema["steps"][number];

function getRequiredPrompt({ label, prompt }: { label: string; prompt: string }) {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error(`Missing practice image prompt for ${label}`);
  }

  return trimmedPrompt;
}

export function getPracticeImagePrompts({
  scenario,
  steps,
}: {
  scenario: PracticeScenario;
  steps: PracticeStep[];
}) {
  return [
    getRequiredPrompt({ label: "scenario", prompt: scenario.imagePrompt }),
    ...steps.map((step, index) =>
      getRequiredPrompt({ label: `step ${index + 1}`, prompt: step.imagePrompt }),
    ),
  ];
}
