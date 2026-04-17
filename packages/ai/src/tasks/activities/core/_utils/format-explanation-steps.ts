type ExplanationPromptStep = {
  text: string;
  title: string;
};

/**
 * Explanation activities can now include hook or recap screens that omit
 * either the title or the body. This formatter keeps a single step readable in
 * downstream prompts so the model sees useful context instead of lines like
 * `1. : ` or duplicated punctuation.
 */
function formatExplanationStepForPrompt({
  index,
  step,
}: {
  index: number;
  step: ExplanationPromptStep;
}) {
  if (step.title && step.text) {
    return `${index}. ${step.title}: ${step.text}`;
  }

  if (step.title) {
    return `${index}. ${step.title}`;
  }

  return `${index}. ${step.text}`;
}

/**
 * Practice and quiz prompts both consume explanation steps as one numbered
 * block of context. Keeping that serialization in one helper prevents the two
 * downstream tasks from drifting if explanation screens gain more title/body
 * edge cases later on.
 */
export function formatExplanationStepsForPrompt(steps: ExplanationPromptStep[]) {
  return steps
    .map((step, index) => formatExplanationStepForPrompt({ index: index + 1, step }))
    .join("\n");
}
