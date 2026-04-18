import { type ActivityExplanationSchema } from "@zoonk/ai/tasks/activities/core/explanation";
import { type MultipleChoiceStepContent } from "@zoonk/core/steps/contract/content";
import { type ActivitySteps } from "./get-activity-steps";

export type ExplanationActivityPlanEntry =
  | {
      kind: "multipleChoice";
      options: MultipleChoiceStepContent["options"];
      question: string;
    }
  | {
      kind: "static";
      text: string;
      title: string;
    }
  | { kind: "visual" };

type ExplanationPlan = {
  entries: ExplanationActivityPlanEntry[];
  sourceSteps: ActivitySteps;
  visualSteps: ActivitySteps;
};

/**
 * The explanation task points each predict check at the step title after which
 * it should be inserted. If the model echoes a title that does not exactly
 * match any step, we fall back to the last step so the check is never dropped
 * silently — the activity still benefits from the intended reinforcement.
 */
function getPredictionInsertionStep({
  predictionStep,
  stepTitles,
}: {
  predictionStep: string;
  stepTitles: string[];
}) {
  if (stepTitles.includes(predictionStep)) {
    return predictionStep;
  }

  return stepTitles.at(-1) ?? null;
}

/**
 * Predict checks stay attached to their surrounding step even if the model
 * misses the exact title once. Grouping them up front lets the main plan
 * builder read as a linear walk over the explanation array instead of
 * interleaving lookup logic inside each step iteration.
 */
function buildPredictionMap(
  content: ActivityExplanationSchema,
): Map<string, ActivityExplanationSchema["predict"]> {
  const stepTitles = content.explanation.map((step) => step.title);
  const predictionMap = new Map<string, ActivityExplanationSchema["predict"]>();

  for (const prediction of content.predict) {
    const insertionStep = getPredictionInsertionStep({
      predictionStep: prediction.step,
      stepTitles,
    });

    if (insertionStep) {
      const existing = predictionMap.get(insertionStep) ?? [];
      predictionMap.set(insertionStep, [...existing, prediction]);
    }
  }

  return predictionMap;
}

/**
 * Every narrative step expands into a static step (the prose), a visual step
 * (the illustration), and any predict checks that belong after this step.
 * Keeping all three side-by-side here matches the learner's experienced order
 * and avoids reconstructing the sequence elsewhere in the pipeline.
 */
function buildStepEntries({
  predictionMap,
  step,
}: {
  predictionMap: Map<string, ActivityExplanationSchema["predict"]>;
  step: ActivityExplanationSchema["explanation"][number];
}): ExplanationActivityPlanEntry[] {
  const predictions = predictionMap.get(step.title) ?? [];

  return [
    { kind: "static", text: step.text, title: step.title },
    { kind: "visual" },
    ...predictions.map<ExplanationActivityPlanEntry>((prediction) => ({
      kind: "multipleChoice",
      options: prediction.options,
      question: prediction.question,
    })),
  ];
}

/**
 * The shared visual-description generator should only see explanation prose
 * steps. Predict checks and the closing anchor do not need visuals.
 */
function buildVisualSteps(content: ActivityExplanationSchema): ActivitySteps {
  return content.explanation.map((step) => ({
    text: step.text,
    title: step.title,
  }));
}

/**
 * Practice and quiz generation need the explanation prose plus the anchor, but
 * not the visual placeholders or predict checks. This helper keeps that
 * downstream source list aligned with the explanation structure in one place.
 */
function buildSourceSteps(content: ActivityExplanationSchema): ActivitySteps {
  return [
    ...content.explanation.map((step) => ({
      text: step.text,
      title: step.title,
    })),
    {
      text: content.anchor.text,
      title: content.anchor.title,
    },
  ];
}

/**
 * The explanation activity mixes read-only copy, visuals, and quick checks
 * in one experience. Building one canonical ordered plan keeps the workflow,
 * save step, and downstream content reuse all anchored to the same source of
 * truth instead of re-deriving the sequence in multiple places.
 */
export function buildExplanationActivityPlan(content: ActivityExplanationSchema): ExplanationPlan {
  const predictionMap = buildPredictionMap(content);

  const stepEntries = content.explanation.flatMap((step) =>
    buildStepEntries({ predictionMap, step }),
  );

  return {
    entries: [
      ...stepEntries,
      {
        kind: "static",
        text: content.anchor.text,
        title: content.anchor.title,
      },
    ],
    sourceSteps: buildSourceSteps(content),
    visualSteps: buildVisualSteps(content),
  };
}
