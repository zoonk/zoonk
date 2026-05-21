import { describe, expect, it } from "vitest";
import { getPhaseOrder, isGeneratedLessonKind } from "./generation-phase-config";
import { calculateWeightedProgress, getPhaseStatus } from "./generation-phases";

describe(isGeneratedLessonKind, () => {
  it("keeps non-generated lesson rows out of lesson generation", () => {
    expect(isGeneratedLessonKind("custom")).toBe(false);
    expect(isGeneratedLessonKind("review")).toBe(false);
    expect(isGeneratedLessonKind("explanation")).toBe(true);
    expect(isGeneratedLessonKind("tutorial")).toBe(true);
  });
});

describe(getPhaseOrder, () => {
  it("keeps explanation generation split into content, visual planning, images, and saving", () => {
    expect(getPhaseOrder("explanation")).toStrictEqual([
      "gettingStarted",
      "creatingLessonImage",
      "writingContent",
      "preparingImages",
      "creatingImages",
      "saving",
    ]);
  });

  it("keeps vocabulary generation split into enrichment and media phases", () => {
    expect(getPhaseOrder("vocabulary")).toStrictEqual([
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
  it("marks the explanation visual planning phase active when image prompts are streaming", () => {
    expect(
      getPhaseStatus(
        "preparingImages",
        ["getLesson", "setLessonAsRunning", "generateExplanationContent"],
        "generateImagePrompts",
        "explanation",
      ),
    ).toBe("active");
  });

  it("marks the vocabulary audio phase active when word audio is streaming", () => {
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

  it("keeps the final completion write inside the saving phase", () => {
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
          "generateLessonImage",
          "setLessonAsCompleted",
        ],
        null,
        "explanation",
      ),
    ).toBe("completed");
  });

  it("marks lesson thumbnail generation as its own active phase", () => {
    expect(
      getPhaseStatus(
        "creatingLessonImage",
        [
          "getLesson",
          "setLessonAsRunning",
          "generateExplanationContent",
          "generateImagePrompts",
          "generateStepImages",
          "saveExplanationLesson",
        ],
        "generateLessonImage",
        "explanation",
      ),
    ).toBe("active");
  });
});

describe(calculateWeightedProgress, () => {
  it("uses only the selected lesson kind's phases when calculating progress", () => {
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
