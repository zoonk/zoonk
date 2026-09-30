import { type QuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { checkQuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation-checks";
import { type StepKind } from "@zoonk/db";
import { getOptionId, shuffleAnswerOptions } from "../_utils/answer-options";
import { safeParseStepContent } from "../steps/contract/step-contract";

export type ExplanationStep = { content: object; kind: StepKind };

type Screen = QuickExplanation["screens"][number];
type CheckOption = QuickExplanation["check"]["options"][number];

function toExplanationScreen(screen: Screen) {
  const image = screen.imagePrompt ? { alt: screen.title, prompt: screen.imagePrompt } : undefined;
  return { image, text: screen.text, title: screen.title };
}

function toCheckOption(option: CheckOption, index: number) {
  return {
    id: getOptionId(index),
    isCorrect: option.isCorrect,
    reason: option.feedback,
    text: option.text,
  };
}

function toSteps(explanation: QuickExplanation): ExplanationStep[] {
  return [
    ...explanation.screens.map((screen) => ({
      content: toExplanationScreen(screen),
      kind: "explanation" as const,
    })),
    {
      content: {
        options: shuffleAnswerOptions(explanation.check.options).map((option, index) =>
          toCheckOption(option, index),
        ),
        question: explanation.check.question,
      },
      kind: "check",
    },
    { content: { ideas: explanation.recap.map((text) => ({ text })) }, kind: "summary" },
  ];
}

/**
 * Turns a quick explanation into lesson screens: one explanation screen per story screen (with the
 * picture it asked for), the check with a reason on every option, and the "Now you know" recap as
 * the summary card. Every screen must pass the step contract and the explanation's own checks;
 * the problems say what failed, so nothing broken reaches a learner.
 */
export function toExplanationSteps(explanation: QuickExplanation): {
  problems: string[];
  steps: ExplanationStep[];
} {
  const checked = toSteps(explanation).map((step, index) => {
    const parsed = safeParseStepContent(step.kind, step.content);

    return parsed.success
      ? { problem: null, step: { content: parsed.data, kind: step.kind } }
      : { problem: `Screen ${index + 1} (${step.kind}) breaks the step contract.`, step };
  });

  return {
    problems: [
      ...checkQuickExplanation(explanation),
      ...checked.flatMap((entry) => (entry.problem ? [entry.problem] : [])),
    ],
    steps: checked.map((entry) => entry.step),
  };
}
