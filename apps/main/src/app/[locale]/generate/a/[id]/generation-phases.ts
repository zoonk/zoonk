import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { ACTIVITY_STEPS, type ActivityStepName } from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import {
  AudioLinesIcon,
  BookOpenIcon,
  BookTextIcon,
  CheckCircleIcon,
  ImageIcon,
  LayersIcon,
  type LucideIcon,
  MicIcon,
  PaletteIcon,
  PenLineIcon,
} from "lucide-react";

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

const ALL_CONTENT_STEPS: ActivityStepName[] = [
  "generateBackgroundContent",
  "generateChallengeContent",
  "generateCustomContent",
  "generateExamplesContent",
  "generateExplanationContent",
  "generateMechanicsContent",
  "generateQuizContent",
  "generateReviewContent",
  "generateStoryContent",
  "generateVocabularyContent",
];

const ALL_VOCABULARY_STEPS: ActivityStepName[] = [
  "saveVocabularyWords",
  "generateVocabularyPronunciation",
  "generateVocabularyAudio",
  "updateVocabularyEnrichments",
];

const ALL_COMPLETION_STEPS: ActivityStepName[] = [
  "setBackgroundAsCompleted",
  "setChallengeAsCompleted",
  "setCustomAsCompleted",
  "setExamplesAsCompleted",
  "setExplanationAsCompleted",
  "setMechanicsAsCompleted",
  "setQuizAsCompleted",
  "setReviewAsCompleted",
  "setStoryAsCompleted",
  "setVocabularyAsCompleted",
  "setActivityAsCompleted",
];

/**
 * Builds a finishing array that includes all content, vocabulary, and completion steps
 * except the ones assigned to other phases for this kind.
 */
function getFinishingSteps(exclude: ActivityStepName[]): ActivityStepName[] {
  const excluded = new Set(exclude);
  return [
    ...ALL_CONTENT_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_VOCABULARY_STEPS.filter((step) => !excluded.has(step)),
    ...ALL_COMPLETION_STEPS,
  ];
}

const EXPLANATION_DEPS: ActivityStepName[] = [
  "setActivityAsRunning",
  "generateBackgroundContent",
  "generateExplanationContent",
];

function getPhaseSteps(kind: ActivityKind): Record<PhaseName, ActivityStepName[]> {
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

function getPhaseWeights(kind: ActivityKind): Record<PhaseName, number> {
  if (kind === "vocabulary") {
    return {
      addingPronunciation: 25,
      buildingWordList: 20,
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 3,
      preparingVisuals: 0,
      processingDependencies: 0,
      recordingAudio: 42,
      writingContent: 0,
    };
  }

  if (kind === "background" || kind === "custom") {
    return {
      addingPronunciation: 0,
      buildingWordList: 0,
      creatingImages: 43,
      finishing: 7,
      gettingStarted: 3,
      preparingVisuals: 22,
      processingDependencies: 0,
      recordingAudio: 0,
      writingContent: 25,
    };
  }

  if (kind === "story" || kind === "challenge" || kind === "review") {
    return {
      addingPronunciation: 0,
      buildingWordList: 0,
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 5,
      preparingVisuals: 0,
      processingDependencies: 40,
      recordingAudio: 0,
      writingContent: 45,
    };
  }

  return {
    addingPronunciation: 0,
    buildingWordList: 0,
    creatingImages: 35,
    finishing: 9,
    gettingStarted: 3,
    preparingVisuals: 18,
    processingDependencies: 15,
    recordingAudio: 0,
    writingContent: 20,
  };
}

const SUPPORTED_KINDS: ActivityKind[] = [
  "background",
  "challenge",
  "custom",
  "examples",
  "explanation",
  "mechanics",
  "quiz",
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
        "Add them to the appropriate phase in generation-phases.ts",
    );
  }
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  addingPronunciation: MicIcon,
  buildingWordList: BookTextIcon,
  creatingImages: ImageIcon,
  finishing: CheckCircleIcon,
  gettingStarted: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  processingDependencies: LayersIcon,
  recordingAudio: AudioLinesIcon,
  writingContent: PenLineIcon,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
): PhaseStatus {
  const phaseSteps = getPhaseSteps(activityKind);
  return getStatus(phase, completedSteps, currentStep, phaseSteps);
}

export function calculateWeightedProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
): number {
  const phaseSteps = getPhaseSteps(activityKind);
  const phaseOrder = getPhaseOrder(activityKind);
  const phaseWeights = getPhaseWeights(activityKind);
  return calculateProgress(completedSteps, currentStep, { phaseOrder, phaseSteps, phaseWeights });
}
