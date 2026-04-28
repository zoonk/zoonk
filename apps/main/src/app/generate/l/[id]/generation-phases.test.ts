import { isGeneratedLessonKind } from "@/lib/generation/lesson-generation-phase-config";
import { describe, expect, test } from "vitest";
import { calculateWeightedProgress, getPhaseOrder, getPhaseStatus } from "./generation-phases";

describe(isGeneratedLessonKind, () => {
  test("keeps review lessons out of lesson generation", () => {
    expect(isGeneratedLessonKind("review")).toBe(false);
    expect(isGeneratedLessonKind("explanation")).toBe(true);
  });
});

describe(getPhaseOrder, () => {
  test("keeps explanation generation split into content, visual planning, images, and saving", () => {
    expect(getPhaseOrder("explanation")).toEqual([
      "gettingStarted",
      "writingContent",
      "preparingImages",
      "creatingImages",
      "saving",
    ]);
  });

  test("keeps vocabulary generation split into enrichment and media phases", () => {
    expect(getPhaseOrder("vocabulary")).toEqual([
      "gettingStarted",
      "buildingWordList",
      "creatingExercises",
      "addingPronunciation",
      "addingRomanization",
      "recordingAudio",
      "saving",
    ]);
  });
});

describe(getPhaseStatus, () => {
  test("marks the explanation visual planning phase active when image prompts are streaming", () => {
    expect(
      getPhaseStatus(
        "preparingImages",
        ["getLesson", "setLessonAsRunning", "generateExplanationContent"],
        "generateImagePrompts",
        "explanation",
      ),
    ).toBe("active");
  });

  test("marks the vocabulary audio phase active when word audio is streaming", () => {
    expect(
      getPhaseStatus(
        "recordingAudio",
        [
          "getLesson",
          "setLessonAsRunning",
          "generateVocabularyContent",
          "generateVocabularyDistractors",
          "generateVocabularyPronunciation",
          "generateVocabularyRomanization",
        ],
        "generateVocabularyAudio",
        "vocabulary",
      ),
    ).toBe("active");
  });

  test("keeps the final completion write inside the saving phase", () => {
    expect(
      getPhaseStatus(
        "saving",
        [
          "getLesson",
          "setLessonAsRunning",
          "generateExplanationContent",
          "generateImagePrompts",
          "generateStepImages",
          "saveExplanationLesson",
          "setLessonAsCompleted",
        ],
        null,
        "explanation",
      ),
    ).toBe("completed");
  });
});

describe(calculateWeightedProgress, () => {
  test("uses only the selected lesson kind's phases when calculating progress", () => {
    expect(
      calculateWeightedProgress(
        [
          "getLesson",
          "setLessonAsRunning",
          "generateVocabularyContent",
          "generateVocabularyDistractors",
          "generateVocabularyPronunciation",
        ],
        "generateVocabularyAudio",
        "vocabulary",
      ),
    ).toBeGreaterThan(40);
  });
});
