import { type PracticeScenario, type PracticeStep } from "../generate-practice-content-step";

/**
 * Practice image prompts are required AI output. This helper only preserves
 * the persisted step order and trims whitespace; it fails fast when a prompt
 * is missing so the workflow does not invent fallback scenes prelaunch.
 */
function getRequiredPrompt({ label, prompt }: { label: string; prompt: string }) {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error(`Missing practice image prompt for ${label}`);
  }

  return trimmedPrompt;
}

/**
 * Returns one image prompt per persisted practice step: scenario first, then
 * one prompt for each question step in visible order.
 */
export function getPracticeImagePrompts({
  scenario,
  steps,
}: {
  scenario: PracticeScenario;
  steps: PracticeStep[];
}) {
  return [
    getRequiredPrompt({
      label: "scenario",
      prompt: scenario.imagePrompt,
    }),
    ...steps.map((step, index) =>
      getRequiredPrompt({
        label: `step ${index + 1}`,
        prompt: step.imagePrompt,
      }),
    ),
  ];
}
