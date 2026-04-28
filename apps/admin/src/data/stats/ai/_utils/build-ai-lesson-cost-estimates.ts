import {
  type TaskUsageByName,
  calculateAverageRequestsPerEntity,
  estimateSentenceAudioSeconds,
  estimateWordAudioSeconds,
} from "../ai-task-stats";
import {
  LANGUAGE_GATEWAY_TASKS,
  LANGUAGE_TTS_ESTIMATE_NOTE,
  LANGUAGE_TTS_HEURISTIC_NOTE,
  STEP_IMAGE_PROMPTS_TASK,
  STEP_SELECT_IMAGE_TASK,
} from "./ai-cost-estimate-constants";
import {
  buildGatewayLineItem,
  buildStepImageLineItem,
  buildTtsLineItem,
  getAverageTaskRequestsPerRun,
  isEstimateLineItem,
  sumLineItems,
} from "./ai-cost-estimate-helpers";
import { type AiGenerationCostEstimate, type StructureStats } from "./ai-cost-estimate-types";

/**
 * Explanation lessons now carry the main teaching content, while practice and
 * quiz lessons are deterministic companions generated from recent explanations.
 */
export function buildCoreLessonEstimate({
  structureStats,
  usageByTask,
}: {
  structureStats: StructureStats;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const coreLessonCount = structureStats.coreLessonCount;
  const lineItems = [
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageLessonCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonExplanationCount,
      }),
      taskName: "lesson-explanation",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageLessonCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonPracticeCount,
      }),
      taskName: "lesson-practice",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageLessonCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonQuizCount,
      }),
      taskName: "lesson-quiz",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageLessonCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonExplanationCount,
      }),
      taskName: STEP_IMAGE_PROMPTS_TASK,
      usageByTask,
    }),
    buildStepImageLineItem({
      entityCount: coreLessonCount,
      lessonKind: "explanation",
      structureStats,
      usageByTask,
    }),
    buildStepImageLineItem({
      entityCount: coreLessonCount,
      lessonKind: "practice",
      structureStats,
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageTaskRequestsPerRun({
        entityCount: coreLessonCount,
        taskName: STEP_SELECT_IMAGE_TASK,
        usageByTask,
      }),
      taskName: STEP_SELECT_IMAGE_TASK,
      usageByTask,
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description:
      "Explanation lesson generation plus practice, quiz, step image prompts, generated step images, and select-image quiz media.",
    kind: "coreLesson",
    lineItems,
    notes: [],
    runLabel: "completed explanation lessons",
    sampleCount: coreLessonCount,
    title: "Explanation Lesson",
    totalEstimatedCost: sumLineItems(lineItems),
  };
}

/**
 * Tutorial lessons use one procedural content-generation call.
 */
export function buildTutorialLessonEstimate({
  structureStats,
  usageByTask,
}: {
  structureStats: StructureStats;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const tutorialLessonCount = structureStats.tutorialLessonCount;
  const lineItems = [
    buildGatewayLineItem({
      averageRequestsPerRun: 1,
      taskName: "lesson-tutorial",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: 1,
      taskName: STEP_IMAGE_PROMPTS_TASK,
      usageByTask,
    }),
    buildStepImageLineItem({
      entityCount: tutorialLessonCount,
      lessonKind: "tutorial",
      structureStats,
      usageByTask,
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description: "Tutorial lesson generation using the procedural content task.",
    kind: "tutorialLesson",
    lineItems,
    notes: [],
    runLabel: "completed tutorial lessons",
    sampleCount: tutorialLessonCount,
    title: "Tutorial Lesson",
    totalEstimatedCost: sumLineItems(lineItems),
  };
}

/**
 * Language lessons rely on Gateway-tracked text tasks plus a separate inferred
 * TTS cost because the audio generation calls bypass AI Gateway reporting.
 */
export function buildLanguageLessonEstimate({
  structureStats,
  usageByTask,
}: {
  structureStats: StructureStats;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const languageLessonCount = structureStats.languageLessonCount;
  const averageWordClipCount = getAverageLessonCount({
    entityCount: languageLessonCount,
    totalCount: structureStats.languageAudioWordClipCount,
  });
  const averageSentenceWordCount = getAverageLessonCount({
    entityCount: languageLessonCount,
    totalCount: structureStats.languageAudioSentenceWordCount,
  });
  const totalAudioSeconds =
    estimateWordAudioSeconds(averageWordClipCount) +
    estimateSentenceAudioSeconds(averageSentenceWordCount);
  const lineItems = [
    ...LANGUAGE_GATEWAY_TASKS.map((taskName) =>
      buildGatewayLineItem({
        averageRequestsPerRun: getAverageTaskRequestsPerRun({
          entityCount: languageLessonCount,
          taskName,
          usageByTask,
        }),
        taskName,
        usageByTask,
      }),
    ).filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item)),
    buildTtsLineItem({
      totalAudioSeconds,
      totalInputWordCount: averageWordClipCount + averageSentenceWordCount,
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description:
      "Vocabulary, grammar, reading, translation/romanization/pronunciation helpers, and inferred TTS cost for generated audio.",
    kind: "languageLesson",
    lineItems,
    notes: [LANGUAGE_TTS_ESTIMATE_NOTE, LANGUAGE_TTS_HEURISTIC_NOTE],
    runLabel: "completed language lessons",
    sampleCount: languageLessonCount,
    title: "Full Language Lesson",
    totalEstimatedCost: sumLineItems(lineItems),
  };
}

/**
 * Lesson-level builders repeatedly need the same normalization from raw counts
 * into "average generated items per lesson" ratios.
 */
function getAverageLessonCount({
  entityCount,
  totalCount,
}: {
  entityCount: number;
  totalCount: number;
}) {
  return calculateAverageRequestsPerEntity({ entityCount, requestCount: totalCount });
}
