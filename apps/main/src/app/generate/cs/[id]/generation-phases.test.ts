import { describe, expect, test } from "vitest";
import { getPhaseOrder, getPhaseStatus } from "./generation-phases";

describe("course generation phases", () => {
  test("uses vocabulary-specific tail phases for language courses", () => {
    const phases = getPhaseOrder({
      completedSteps: ["getLessonActivities"],
      currentStep: "generateVocabularyContent",
      targetLanguage: "es",
    });

    expect(phases).toContain("buildingWordList");
    expect(phases).toContain("addingPronunciation");
    expect(phases).toContain("recordingAudio");
    expect(phases).not.toContain("writingContent");
    expect(phases).not.toContain("preparingVisuals");
    expect(phases).not.toContain("creatingImages");
  });

  test("keeps non-language tail phases for regular courses", () => {
    const phases = getPhaseOrder({
      completedSteps: ["getLessonActivities"],
      currentStep: "generateBackgroundContent",
      targetLanguage: null,
    });

    expect(phases).toContain("writingContent");
    expect(phases).toContain("preparingVisuals");
    expect(phases).toContain("creatingImages");
    expect(phases).not.toContain("buildingWordList");
    expect(phases).not.toContain("addingPronunciation");
    expect(phases).not.toContain("recordingAudio");
  });

  test("marks buildingWordList as active for vocabulary steps", () => {
    const status = getPhaseStatus(
      "buildingWordList",
      ["setActivityAsRunning"],
      "generateVocabularyContent",
      "es",
    );

    expect(status).toBe("active");
  });
});
