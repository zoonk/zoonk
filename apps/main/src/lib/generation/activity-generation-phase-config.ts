import { ACTIVITY_STEPS, type ActivityStepName } from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import {
  EXPLANATION_DEPS,
  LISTENING_DEPENDENCY_STEPS,
  LISTENING_WRITING_STEPS,
  getFinishingSteps,
} from "./activity-generation-phase-step-groups";

export { getPhaseWeights } from "./activity-generation-phase-weights";

export type PhaseName =
  | "gettingStarted"
  | "processingDependencies"
  | "writingContent"
  | "preparingVisuals"
  | "creatingImages"
  | "buildingWordList"
  | "addingPronunciation"
  | "recordingAudio"
  | "finishing";

export type FirstActivityKind = "background" | "custom" | "vocabulary";

const CUSTOM_INFERENCE_STEPS = new Set(["generateCustomContent", "setCustomAsCompleted"]);

export function inferFirstActivityKind(params: {
  completedSteps: readonly string[];
  currentStep: string | null;
  targetLanguage: string | null;
}): FirstActivityKind {
  if (params.targetLanguage !== null) {
    return "vocabulary";
  }

  const seenSteps = params.currentStep
    ? [...params.completedSteps, params.currentStep]
    : params.completedSteps;

  if (seenSteps.some((step) => CUSTOM_INFERENCE_STEPS.has(step))) {
    return "custom";
  }

  return "background";
}

export function getPhaseOrder(kind: ActivityKind): PhaseName[] {
  if (kind === "vocabulary") {
    return [
      "gettingStarted",
      "buildingWordList",
      "addingPronunciation",
      "recordingAudio",
      "finishing",
    ];
  }

  if (kind === "reading") {
    return ["gettingStarted", "buildingWordList", "recordingAudio", "finishing"];
  }

  if (kind === "listening") {
    return [
      "gettingStarted",
      "processingDependencies",
      "buildingWordList",
      "recordingAudio",
      "writingContent",
      "finishing",
    ];
  }

  if (kind === "grammar") {
    return ["gettingStarted", "writingContent", "finishing"];
  }

  if (kind === "background" || kind === "custom") {
    return ["gettingStarted", "writingContent", "preparingVisuals", "creatingImages", "finishing"];
  }

  if (kind === "story" || kind === "challenge" || kind === "review") {
    return ["gettingStarted", "processingDependencies", "writingContent", "finishing"];
  }

  return [
    "gettingStarted",
    "processingDependencies",
    "writingContent",
    "preparingVisuals",
    "creatingImages",
    "finishing",
  ];
}

export function getPhaseSteps(kind: ActivityKind): Record<PhaseName, ActivityStepName[]> {
  const shared = {
    addingPronunciation: [] as ActivityStepName[],
    buildingWordList: [] as ActivityStepName[],
    creatingImages: ["generateImages", "generateQuizImages"] as ActivityStepName[],
    gettingStarted: ["getLessonActivities"] as ActivityStepName[],
    preparingVisuals: ["generateVisuals"] as ActivityStepName[],
    recordingAudio: [] as ActivityStepName[],
  };

  if (kind === "vocabulary") {
    return {
      addingPronunciation: ["generateVocabularyPronunciation"],
      buildingWordList: [
        "setActivityAsRunning",
        "generateVocabularyContent",
        "saveVocabularyWords",
      ],
      creatingImages: [],
      finishing: [
        "generateVisuals",
        "generateImages",
        "generateQuizImages",
        ...getFinishingSteps([
          "generateVocabularyContent",
          "saveVocabularyWords",
          "generateVocabularyPronunciation",
          "generateVocabularyAudio",
        ]),
      ],
      gettingStarted: ["getLessonActivities"],
      preparingVisuals: [],
      processingDependencies: [],
      recordingAudio: ["generateVocabularyAudio"],
      writingContent: [],
    };
  }

  if (kind === "grammar") {
    return {
      ...shared,
      creatingImages: [],
      finishing: [
        "generateVisuals",
        "generateImages",
        "generateQuizImages",
        ...getFinishingSteps(["generateGrammarContent"]),
      ],
      preparingVisuals: [],
      processingDependencies: [],
      writingContent: ["setActivityAsRunning", "generateGrammarContent"],
    };
  }

  if (kind === "reading") {
    return {
      ...shared,
      buildingWordList: ["setActivityAsRunning", "generateSentences", "saveSentences"],
      creatingImages: [],
      finishing: [
        "generateVisuals",
        "generateImages",
        "generateQuizImages",
        ...getFinishingSteps([
          "generateSentences",
          "saveSentences",
          "generateAudio",
          "updateSentenceEnrichments",
        ]),
      ],
      preparingVisuals: [],
      processingDependencies: [],
      recordingAudio: ["generateAudio", "updateSentenceEnrichments"],
      writingContent: [],
    };
  }

  if (kind === "listening") {
    return {
      ...shared,
      buildingWordList: ["saveSentences"],
      creatingImages: [],
      finishing: [
        "generateVisuals",
        "generateImages",
        "generateQuizImages",
        ...getFinishingSteps([
          ...LISTENING_DEPENDENCY_STEPS,
          ...LISTENING_WRITING_STEPS,
          "generateSentences",
          "saveSentences",
          "generateAudio",
          "updateSentenceEnrichments",
          "setListeningAsCompleted",
        ]),
        "setListeningAsCompleted",
      ],
      preparingVisuals: [],
      processingDependencies: LISTENING_DEPENDENCY_STEPS,
      recordingAudio: ["generateAudio", "updateSentenceEnrichments"],
      writingContent: LISTENING_WRITING_STEPS,
    };
  }

  if (kind === "background") {
    return {
      ...shared,
      finishing: getFinishingSteps(["generateBackgroundContent"]),
      processingDependencies: [],
      writingContent: ["setActivityAsRunning", "generateBackgroundContent"],
    };
  }

  if (kind === "custom") {
    return {
      ...shared,
      finishing: getFinishingSteps(["generateCustomContent"]),
      processingDependencies: [],
      writingContent: ["setActivityAsRunning", "generateCustomContent"],
    };
  }

  if (kind === "explanation") {
    return {
      ...shared,
      finishing: getFinishingSteps(["generateBackgroundContent", "generateExplanationContent"]),
      processingDependencies: ["setActivityAsRunning", "generateBackgroundContent"],
      writingContent: ["generateExplanationContent"],
    };
  }

  const contentStepMap: Partial<Record<ActivityKind, ActivityStepName>> = {
    challenge: "generateChallengeContent",
    examples: "generateExamplesContent",
    mechanics: "generateMechanicsContent",
    quiz: "generateQuizContent",
    review: "generateReviewContent",
    story: "generateStoryContent",
  };

  const writingStep = contentStepMap[kind] ?? "generateQuizContent";

  return {
    ...shared,
    finishing: getFinishingSteps([
      "generateBackgroundContent",
      "generateExplanationContent",
      writingStep,
    ]),
    processingDependencies: EXPLANATION_DEPS,
    writingContent: [writingStep],
  };
}

const SUPPORTED_KINDS: ActivityKind[] = [
  "background",
  "challenge",
  "custom",
  "examples",
  "explanation",
  "grammar",
  "listening",
  "mechanics",
  "quiz",
  "reading",
  "review",
  "story",
  "vocabulary",
];

for (const kind of SUPPORTED_KINDS) {
  const phaseSteps = getPhaseSteps(kind);
  const allPhaseSteps = new Set(Object.values(phaseSteps).flat());
  const missingSteps = ACTIVITY_STEPS.filter(
    (step) => step !== "workflowError" && !allPhaseSteps.has(step),
  );

  if (missingSteps.length > 0) {
    throw new Error(
      `Missing activity steps for kind "${kind}": ${missingSteps.join(", ")}. ` +
        "Add them to the appropriate phase in activity-generation-phase-config.ts",
    );
  }
}
