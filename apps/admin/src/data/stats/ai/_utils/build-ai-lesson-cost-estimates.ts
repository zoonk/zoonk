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
} from "./ai-cost-estimate-constants";
import {
  buildGatewayLineItem,
  buildTtsLineItem,
  buildVisualLineItems,
  getAppliedActivityShares,
  getAverageTaskRequestsPerRun,
  isEstimateLineItem,
  sumLineItems,
} from "./ai-cost-estimate-helpers";
import { type AiGenerationCostEstimate, type StructureStats } from "./ai-cost-estimate-types";

/**
 * Core lessons combine lesson classification, a fixed explanation/practice/quiz
 * pipeline, explanation-specific visuals, and exactly one applied activity slot.
 */
export function buildCoreLessonEstimate({
  structureStats,
  usageByTask,
}: {
  structureStats: StructureStats;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const coreLessonCount = structureStats.coreLessonCount;
  const appliedShares = getAppliedActivityShares({
    investigationCount: structureStats.coreLessonInvestigationCount,
    storyCount: structureStats.coreLessonStoryCount,
  });
  const lineItems = [
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "lesson-kind", usageByTask }),
    buildGatewayLineItem({
      averageRequestsPerRun: 1,
      taskName: "lesson-core-activities",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: 1,
      taskName: "applied-activity-kind",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageActivityCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonExplanationCount,
      }),
      taskName: "activity-explanation",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageActivityCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonPracticeCount,
      }),
      taskName: "activity-practice",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageActivityCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonQuizCount,
      }),
      taskName: "activity-quiz",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageActivityCount({
        entityCount: coreLessonCount,
        totalCount: structureStats.coreLessonExplanationCount,
      }),
      taskName: "step-visual-descriptions",
      usageByTask,
    }),
    ...buildVisualLineItems({
      activityKind: "explanation",
      entityCount: coreLessonCount,
      structureStats,
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: getAverageTaskRequestsPerRun({
        entityCount: coreLessonCount,
        taskName: "step-select-image",
        usageByTask,
      }),
      taskName: "step-select-image",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: appliedShares.storyShare,
      taskName: "activity-story-steps",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: appliedShares.storyShare,
      taskName: "activity-story-debrief",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: appliedShares.investigationShare,
      taskName: "activity-investigation-scenario",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: appliedShares.investigationShare,
      taskName: "activity-investigation-accuracy",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: appliedShares.investigationShare,
      taskName: "activity-investigation-actions",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: appliedShares.investigationShare,
      taskName: "activity-investigation-findings",
      usageByTask,
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description:
      "Lesson classification, core activity planning, explanation/practice/quiz generation, explanation visuals, quiz image generation, and one weighted applied activity.",
    kind: "coreLesson",
    lineItems,
    notes: [],
    runLabel: "completed core lessons",
    sampleCount: coreLessonCount,
    title: "Full Core Lesson",
    totalEstimatedCost: sumLineItems(lineItems),
  };
}

/**
 * Custom lessons use a simpler workflow: classify the lesson, plan the custom
 * activities, generate each activity, then run the visual pass for those
 * activities.
 */
export function buildCustomLessonEstimate({
  structureStats,
  usageByTask,
}: {
  structureStats: StructureStats;
  usageByTask: TaskUsageByName;
}): AiGenerationCostEstimate {
  const customLessonCount = structureStats.customLessonCount;
  const averageCustomActivities = getAverageActivityCount({
    entityCount: customLessonCount,
    totalCount: structureStats.customActivityCount,
  });
  const lineItems = [
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "lesson-kind", usageByTask }),
    buildGatewayLineItem({
      averageRequestsPerRun: 1,
      taskName: "lesson-custom-activities",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: averageCustomActivities,
      taskName: "activity-custom",
      usageByTask,
    }),
    buildGatewayLineItem({
      averageRequestsPerRun: averageCustomActivities,
      taskName: "step-visual-descriptions",
      usageByTask,
    }),
    ...buildVisualLineItems({
      activityKind: "custom",
      entityCount: customLessonCount,
      structureStats,
      usageByTask,
    }),
  ].filter((item): item is NonNullable<typeof item> => isEstimateLineItem(item));

  return {
    description:
      "Lesson classification, custom activity planning, custom activity generation, and the visual pass for those activities.",
    kind: "customLesson",
    lineItems,
    notes: [],
    runLabel: "completed custom lessons",
    sampleCount: customLessonCount,
    title: "Full Custom Lesson",
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
  const averageWordClipCount = getAverageActivityCount({
    entityCount: languageLessonCount,
    totalCount: structureStats.languageAudioWordClipCount,
  });
  const averageSentenceWordCount = getAverageActivityCount({
    entityCount: languageLessonCount,
    totalCount: structureStats.languageAudioSentenceWordCount,
  });
  const totalAudioSeconds =
    estimateWordAudioSeconds(averageWordClipCount) +
    estimateSentenceAudioSeconds(averageSentenceWordCount);
  const lineItems = [
    buildGatewayLineItem({ averageRequestsPerRun: 1, taskName: "lesson-kind", usageByTask }),
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
      "Vocabulary, grammar, reading, translation/romanization/pronunciation helpers, and a separate inferred TTS cost for generated audio.",
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
function getAverageActivityCount({
  entityCount,
  totalCount,
}: {
  entityCount: number;
  totalCount: number;
}) {
  return calculateAverageRequestsPerEntity({ entityCount, requestCount: totalCount });
}
