import { describe, expect, test } from "vitest";
import {
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
  inferFirstActivityKind,
} from "./activity-generation-phases";

describe(inferFirstActivityKind, () => {
  test("returns vocabulary when targetLanguage exists", () => {
    const kind = inferFirstActivityKind({
      completedSteps: ["generateCustomContent"],
      currentStep: null,
      targetLanguage: "es",
    });

    expect(kind).toBe("vocabulary");
  });

  test("returns custom when custom steps are observed", () => {
    const kind = inferFirstActivityKind({
      completedSteps: ["generateCustomContent"],
      currentStep: null,
      targetLanguage: null,
    });

    expect(kind).toBe("custom");
  });

  test("falls back to background", () => {
    const kind = inferFirstActivityKind({
      completedSteps: ["getLessonActivities"],
      currentStep: "setActivityAsRunning",
      targetLanguage: null,
    });

    expect(kind).toBe("background");
  });
});

describe(getPhaseOrder, () => {
  test("uses vocabulary-first order for vocabulary activities", () => {
    expect(getPhaseOrder("vocabulary")).toEqual([
      "gettingStarted",
      "buildingWordList",
      "addingPronunciation",
      "recordingAudio",
      "finishing",
    ]);
  });

  test("keeps visual/image phases for non-language activities", () => {
    expect(getPhaseOrder("background")).toEqual([
      "gettingStarted",
      "writingContent",
      "preparingVisuals",
      "creatingImages",
      "finishing",
    ]);
  });
});

describe("vocabulary phase status", () => {
  test("activates buildingWordList for vocabulary content steps", () => {
    const status = getPhaseStatus(
      "buildingWordList",
      ["setActivityAsRunning"],
      "generateVocabularyContent",
      "vocabulary",
    );

    expect(status).toBe("active");
  });

  test("calculates progress for vocabulary flow", () => {
    const progress = calculateWeightedProgress(
      ["setActivityAsRunning", "generateVocabularyContent", "saveVocabularyWords"],
      "generateVocabularyPronunciation",
      "vocabulary",
    );

    expect(progress).toBeGreaterThan(0);
  });
});
