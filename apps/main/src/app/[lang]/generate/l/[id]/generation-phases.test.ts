import { isGeneratedLessonKind } from "@zoonk/core/lessons/generated-companion-kinds";
import { describe, expect, it } from "vitest";
import { getPhaseOrder } from "./generation-phase-config";
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
  it("keeps the explanation usable without waiting for background illustrations", () => {
    expect(getPhaseOrder("explanation")).toStrictEqual([
      "gettingStarted",
      "writingContent",
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

  it("keeps alphabet generation split into content, audio, and saving", () => {
    expect(getPhaseOrder("alphabet")).toStrictEqual([
      "gettingStarted",
      "writingContent",
      "recordingAudio",
      "saving",
    ]);
  });
});

describe(getPhaseStatus, () => {
  it("includes illustration selection in lesson preparation", () => {
    expect(
      getPhaseStatus(
        "writingContent",
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

  it("marks the alphabet content phase active when alphabet content is streaming", () => {
    expect(
      getPhaseStatus(
        "writingContent",
        ["getLesson", "setLessonAsRunning"],
        "generateAlphabetContent",
        "alphabet",
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

  it("finishes explanation progress without decorative thumbnails or background art", () => {
    expect(
      calculateWeightedProgress(
        [
          "getLesson",
          "setLessonAsRunning",
          "generateExplanationContent",
          "generateImagePrompts",
          "saveExplanationLesson",
          "setLessonAsCompleted",
        ],
        null,
        "explanation",
      ),
    ).toBe(100);
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
