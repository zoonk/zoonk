import { type ActivityExplanationSchema } from "@zoonk/ai/tasks/activities/core/explanation";
import { type VisualDescription } from "@zoonk/ai/tasks/steps/visual-descriptions";
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
  | {
      description: VisualDescription;
      kind: "visual";
    };

type ExplanationPlan = {
  entries: ExplanationActivityPlanEntry[];
  sourceSteps: ActivitySteps;
};

/**
 * The explanation task returns prediction insert points by concept title so the
 * save pipeline can keep concept teaching and quick checks coherent. This
 * helper centralizes the fallback behavior when the model returns a title that
 * does not exactly match any concept.
 */
function getPredictionInsertionConcept({
  conceptTitles,
  predictionConcept,
}: {
  conceptTitles: string[];
  predictionConcept: string;
}) {
  if (conceptTitles.includes(predictionConcept)) {
    return predictionConcept;
  }

  return conceptTitles.at(-1) ?? null;
}

/**
 * Prediction checks need to stay attached to their surrounding concept even if
 * the model misses the exact title once. Grouping them up front lets the main
 * plan builder read like the learner flow instead of interleaving lookup logic
 * inside each concept iteration.
 */
function buildPredictionMap(
  content: ActivityExplanationSchema,
): Map<string, ActivityExplanationSchema["predict"]> {
  const conceptTitles = content.concepts.map((concept) => concept.title);
  const predictionMap = new Map<string, ActivityExplanationSchema["predict"]>();

  for (const prediction of content.predict) {
    const insertionConcept = getPredictionInsertionConcept({
      conceptTitles,
      predictionConcept: prediction.concept,
    });

    if (insertionConcept) {
      const existing = predictionMap.get(insertionConcept) ?? [];
      predictionMap.set(insertionConcept, [...existing, prediction]);
    }
  }

  return predictionMap;
}

/**
 * Static explanation screens, prediction checks, and visual placeholders all
 * travel through the same ordered plan so the later save step can persist the
 * exact learner sequence without reconstructing it from separate arrays.
 */
function buildConceptEntries({
  concept,
  predictionMap,
}: {
  concept: ActivityExplanationSchema["concepts"][number];
  predictionMap: Map<string, ActivityExplanationSchema["predict"]>;
}) {
  const entries: ExplanationActivityPlanEntry[] = [
    {
      kind: "static",
      text: concept.text,
      title: concept.title,
    },
  ];

  if (concept.visual) {
    entries.push({
      description: concept.visual,
      kind: "visual",
    });
  }

  const predictions = predictionMap.get(concept.title) ?? [];

  for (const prediction of predictions) {
    entries.push({
      kind: "multipleChoice",
      options: prediction.options,
      question: prediction.question,
    });
  }

  return entries;
}

/**
 * Practice and quiz generation only need the text teaching surfaces, not the
 * visual placeholders or prediction checks. This helper keeps that downstream
 * source list aligned with the new explanation structure in one place.
 */
function buildSourceSteps(content: ActivityExplanationSchema): ActivitySteps {
  return [
    {
      text: content.initialQuestion.question,
      title: "",
    },
    {
      text: content.initialQuestion.explanation,
      title: "",
    },
    {
      text: content.scenario.text,
      title: content.scenario.title,
    },
    ...content.concepts.map((concept) => ({
      text: concept.text,
      title: concept.title,
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

  const conceptEntries = content.concepts.flatMap((concept) =>
    buildConceptEntries({ concept, predictionMap }),
  );

  return {
    entries: [
      {
        kind: "static",
        text: content.initialQuestion.question,
        title: "",
      },
      {
        description: content.initialQuestion.visual,
        kind: "visual",
      },
      {
        kind: "static",
        text: content.initialQuestion.explanation,
        title: "",
      },
      {
        kind: "static",
        text: content.scenario.text,
        title: content.scenario.title,
      },
      ...conceptEntries,
      {
        kind: "static",
        text: content.anchor.text,
        title: content.anchor.title,
      },
    ],
    sourceSteps: buildSourceSteps(content),
  };
}
