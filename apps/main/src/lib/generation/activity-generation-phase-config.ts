import { ACTIVITY_STEPS, type ActivityStepName } from "@/lib/workflow/config";
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

export function getPhaseOrder(kind: ActivityKind): PhaseName[] {
  if (kind === "vocabulary" || kind === "translation") {
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

  if (kind === "custom") {
    return ["gettingStarted", "writingContent", "preparingVisuals", "creatingImages", "finishing"];
  }

  if (kind === "practice" || kind === "challenge" || kind === "quiz") {
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

const SHARED_PHASE_STEPS = {
  addingPronunciation: [] as ActivityStepName[],
  buildingWordList: [] as ActivityStepName[],
  creatingImages: ["generateImages", "generateQuizImages"] as ActivityStepName[],
  gettingStarted: [
    "getLessonActivities",
    "getNeighboringConcepts",
    "setActivityAsRunning",
  ] as ActivityStepName[],
  preparingVisuals: ["generateVisuals"] as ActivityStepName[],
  recordingAudio: [] as ActivityStepName[],
};

const NO_VISUALS_OVERRIDE = {
  creatingImages: [] as ActivityStepName[],
  preparingVisuals: [] as ActivityStepName[],
};

const VISUALS_AS_FINISHING = [
  "generateVisuals",
  "generateImages",
  "generateQuizImages",
] as const satisfies readonly ActivityStepName[];

function getLanguagePhaseSteps(kind: ActivityKind): Record<PhaseName, ActivityStepName[]> | null {
  if (kind === "vocabulary" || kind === "translation") {
    return {
      addingPronunciation: [
        "generateVocabularyPronunciationAndAlternatives",
        "generateVocabularyRomanization",
      ],
      buildingWordList: ["generateVocabularyContent"],
      ...NO_VISUALS_OVERRIDE,
      finishing: [
        ...VISUALS_AS_FINISHING,
        ...getFinishingSteps([
          "generateVocabularyContent",
          "generateVocabularyPronunciationAndAlternatives",
          "generateVocabularyRomanization",
          "generateVocabularyAudio",
          "saveVocabularyActivity",
        ]),
        "saveVocabularyActivity",
      ],
      gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
      processingDependencies: [],
      recordingAudio: ["generateVocabularyAudio"],
      writingContent: [],
    };
  }

  if (kind === "grammar") {
    return {
      ...SHARED_PHASE_STEPS,
      ...NO_VISUALS_OVERRIDE,
      finishing: [
        ...VISUALS_AS_FINISHING,
        ...getFinishingSteps([
          "generateGrammarContent",
          "generateGrammarUserContent",
          "generateGrammarRomanization",
          "saveGrammarActivity",
        ]),
        "saveGrammarActivity",
      ],
      processingDependencies: [],
      writingContent: [
        "generateGrammarContent",
        "generateGrammarUserContent",
        "generateGrammarRomanization",
      ],
    };
  }

  if (kind === "reading") {
    return {
      ...SHARED_PHASE_STEPS,
      buildingWordList: ["generateSentences"],
      ...NO_VISUALS_OVERRIDE,
      finishing: [
        ...VISUALS_AS_FINISHING,
        ...getFinishingSteps([
          "generateSentences",
          "generateAudio",
          "generateReadingRomanization",
          "generateSentenceWordMetadata",
          "generateSentenceWordAudio",
          "generateSentencePronunciationAndAlternatives",
          "saveReadingActivity",
        ]),
        "saveReadingActivity",
      ],
      processingDependencies: [],
      recordingAudio: [
        "generateAudio",
        "generateReadingRomanization",
        "generateSentenceWordMetadata",
        "generateSentenceWordAudio",
        "generateSentencePronunciationAndAlternatives",
      ],
      writingContent: [],
    };
  }

  if (kind === "listening") {
    return {
      ...SHARED_PHASE_STEPS,
      buildingWordList: ["generateSentences"],
      ...NO_VISUALS_OVERRIDE,
      finishing: [
        ...VISUALS_AS_FINISHING,
        ...getFinishingSteps([
          ...LISTENING_DEPENDENCY_STEPS,
          ...LISTENING_WRITING_STEPS,
          "generateSentences",
          "generateAudio",
          "generateReadingRomanization",
          "generateSentenceWordMetadata",
          "generateSentenceWordAudio",
          "generateSentencePronunciationAndAlternatives",
          "saveReadingActivity",
          "saveListeningActivity",
        ]),
        "saveListeningActivity",
      ],
      processingDependencies: LISTENING_DEPENDENCY_STEPS,
      recordingAudio: [
        "generateAudio",
        "generateReadingRomanization",
        "generateSentenceWordMetadata",
        "generateSentenceWordAudio",
        "generateSentencePronunciationAndAlternatives",
        "saveReadingActivity",
      ],
      writingContent: LISTENING_WRITING_STEPS,
    };
  }

  return null;
}

export function getPhaseSteps(kind: ActivityKind): Record<PhaseName, ActivityStepName[]> {
  const languagePhase = getLanguagePhaseSteps(kind);

  if (languagePhase) {
    return languagePhase;
  }

  if (kind === "custom") {
    return {
      ...SHARED_PHASE_STEPS,
      finishing: [
        "getNeighboringConcepts",
        ...getFinishingSteps(["generateCustomContent", "saveCustomActivity"]),
        "saveCustomActivity",
      ],
      gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
      processingDependencies: [],
      writingContent: ["generateCustomContent"],
    };
  }

  if (kind === "explanation") {
    return {
      ...SHARED_PHASE_STEPS,
      finishing: [
        ...getFinishingSteps(["generateExplanationContent", "saveExplanationActivity"]),
        "saveExplanationActivity",
      ],
      processingDependencies: [],
      writingContent: ["generateExplanationContent"],
    };
  }

  if (kind === "quiz") {
    return {
      ...SHARED_PHASE_STEPS,
      ...NO_VISUALS_OVERRIDE,
      finishing: [
        ...VISUALS_AS_FINISHING,
        ...getFinishingSteps([
          "generateExplanationContent",
          "generateQuizContent",
          "generateQuizImages",
          "saveQuizActivity",
        ]),
        "saveQuizActivity",
      ],
      processingDependencies: EXPLANATION_DEPS,
      writingContent: ["generateQuizContent", "generateQuizImages"],
    };
  }

  const contentStepMap: Partial<Record<ActivityKind, ActivityStepName>> = {
    challenge: "generateChallengeContent",
    practice: "generatePracticeContent",
  };

  const saveStepMap: Partial<Record<ActivityKind, ActivityStepName>> = {
    challenge: "saveChallengeActivity",
    practice: "savePracticeActivity",
  };

  const writingStep = contentStepMap[kind] ?? "generateQuizContent";
  const saveStep = saveStepMap[kind] ?? "saveQuizActivity";

  return {
    ...SHARED_PHASE_STEPS,
    finishing: [
      ...getFinishingSteps(["generateExplanationContent", writingStep, saveStep]),
      saveStep,
    ],
    processingDependencies: EXPLANATION_DEPS,
    writingContent: [writingStep],
  };
}

const SUPPORTED_KINDS: ActivityKind[] = [
  "challenge",
  "custom",
  "explanation",
  "grammar",
  "listening",
  "practice",
  "quiz",
  "reading",
  "translation",
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
