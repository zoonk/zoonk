import { type PracticeScenario, type PracticeStep } from "../generate-practice-content-step";

/**
 * Practice is now image-led, so every scenario and decision step needs an
 * image prompt. The AI should author these directly, but this helper fills in
 * a concrete fallback when one prompt comes back blank so we can still render
 * a usable scene instead of failing on a soft-authoring miss.
 */
function getPromptOrFallback({ fallback, prompt }: { fallback: string; prompt: string }) {
  const trimmedPrompt = prompt.trim();

  if (trimmedPrompt) {
    return trimmedPrompt;
  }

  return fallback;
}

/**
 * Fallback prompts read better when reused learner copy becomes a clean
 * sentence. This keeps punctuation from stacking when the authored text
 * already ends with `.`, `?`, or `!`.
 */
function toSentence(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return trimmedValue;
  }

  if (/[.!?]$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return `${trimmedValue}.`;
}

/**
 * The opening scenario image should establish the place, the recurring partner,
 * and the problem the learner is stepping into before the first decision.
 */
function getScenarioFallbackPrompt({ scenario }: { scenario: PracticeScenario }) {
  return [
    "Show the opening scene for a visual-first practice activity.",
    `Short scene label: ${toSentence(scenario.title)}`,
    `Situation: ${toSentence(scenario.text)}`,
    "Make the main person, the setting, and the practical problem immediately visible.",
  ].join(" ");
}

/**
 * Practice question images should carry the clue, artifact, or state change
 * the learner needs to inspect. The fallback prompt keeps that evidence tied
 * to the dialogue, question, and candidate actions when the authored prompt
 * is missing.
 */
function getStepFallbackPrompt({ step }: { step: PracticeStep }) {
  const optionSummary = step.options
    .map((option) => option.text.trim())
    .filter(Boolean)
    .join(", ");

  return [
    "Show the key evidence for this practice decision.",
    step.context ? `Dialogue: ${toSentence(step.context)}` : "",
    `Question: ${toSentence(step.question)}`,
    optionSummary ? `Possible actions: ${toSentence(optionSummary)}` : "",
    "Use a concrete artifact, screen, document, diagram, label, or scene clue the learner can inspect.",
  ]
    .filter(Boolean)
    .join(" ");
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
    getPromptOrFallback({
      fallback: getScenarioFallbackPrompt({ scenario }),
      prompt: scenario.imagePrompt,
    }),
    ...steps.map((step) =>
      getPromptOrFallback({
        fallback: getStepFallbackPrompt({ step }),
        prompt: step.imagePrompt,
      }),
    ),
  ];
}
