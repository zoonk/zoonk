import { enforcePhaseProgression } from "@/lib/generation-phases";
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

  test("falls back to explanation", () => {
    const kind = inferFirstActivityKind({
      completedSteps: ["getLessonActivities"],
      currentStep: "setActivityAsRunning",
      targetLanguage: null,
    });

    expect(kind).toBe("explanation");
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

  test("uses same order for translation activities as vocabulary", () => {
    expect(getPhaseOrder("translation")).toEqual([
      "gettingStarted",
      "buildingWordList",
      "addingPronunciation",
      "recordingAudio",
      "finishing",
    ]);
  });

  test("keeps visual/image phases for non-language activities", () => {
    expect(getPhaseOrder("explanation")).toEqual([
      "gettingStarted",
      "processingDependencies",
      "writingContent",
      "preparingVisuals",
      "creatingImages",
      "finishing",
    ]);
  });

  test("uses grammar-specific order without visual or audio phases", () => {
    expect(getPhaseOrder("grammar")).toEqual(["gettingStarted", "writingContent", "finishing"]);
  });

  test("uses language practice order without visual or audio phases", () => {
    expect(getPhaseOrder("languagePractice")).toEqual([
      "gettingStarted",
      "writingContent",
      "finishing",
    ]);
  });

  test("uses reading-specific order without visuals or pronunciation", () => {
    expect(getPhaseOrder("reading")).toEqual([
      "gettingStarted",
      "buildingWordList",
      "recordingAudio",
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

describe("grammar phase status", () => {
  test("activates writingContent for grammar generation", () => {
    const status = getPhaseStatus(
      "writingContent",
      ["setActivityAsRunning"],
      "generateGrammarContent",
      "grammar",
    );

    expect(status).toBe("active");
  });

  test("calculates progress for grammar flow", () => {
    const progress = calculateWeightedProgress(
      ["setActivityAsRunning", "generateGrammarContent"],
      "setGrammarAsCompleted",
      "grammar",
    );

    expect(progress).toBeGreaterThan(0);
  });
});

describe("language practice phase status", () => {
  test("activates writingContent for language practice generation", () => {
    const status = getPhaseStatus(
      "writingContent",
      ["setActivityAsRunning"],
      "generateLanguagePracticeContent",
      "languagePractice",
    );

    expect(status).toBe("active");
  });

  test("calculates progress for language practice flow", () => {
    const progress = calculateWeightedProgress(
      ["setActivityAsRunning", "generateLanguagePracticeContent"],
      "setLanguagePracticeAsCompleted",
      "languagePractice",
    );

    expect(progress).toBeGreaterThan(0);
  });
});

describe("listening phase status", () => {
  test("returns correct phase order for listening", () => {
    expect(getPhaseOrder("listening")).toEqual([
      "gettingStarted",
      "processingDependencies",
      "buildingWordList",
      "recordingAudio",
      "writingContent",
      "finishing",
    ]);
  });

  test("activates processingDependencies for generateSentences", () => {
    const status = getPhaseStatus(
      "processingDependencies",
      ["setActivityAsRunning"],
      "generateSentences",
      "listening",
    );

    expect(status).toBe("active");
  });

  test("keeps finishing pending during early dependency processing", () => {
    const status = getPhaseStatus(
      "finishing",
      ["setActivityAsRunning", "generateVocabularyContent", "setActivityAsCompleted"],
      "generateGrammarContent",
      "listening",
    );

    expect(status).toBe("pending");
  });

  test("activates writingContent for copyListeningSteps", () => {
    const status = getPhaseStatus(
      "writingContent",
      [
        "setActivityAsRunning",
        "generateSentences",
        "saveSentences",
        "generateAudio",
        "updateSentenceEnrichments",
      ],
      "copyListeningSteps",
      "listening",
    );

    expect(status).toBe("active");
  });

  test("activates finishing at terminal listening completion", () => {
    const status = getPhaseStatus(
      "finishing",
      [
        "setActivityAsRunning",
        "generateVocabularyContent",
        "saveVocabularyWords",
        "generateVocabularyPronunciation",
        "generateVocabularyAudio",
        "generateGrammarContent",
        "generateSentences",
        "saveSentences",
        "generateAudio",
        "updateSentenceEnrichments",
        "copyListeningSteps",
        "setVocabularyAsCompleted",
        "setReadingAsCompleted",
      ],
      "setListeningAsCompleted",
      "listening",
    );

    expect(status).toBe("active");
  });

  test("calculates progress for listening flow", () => {
    const progress = calculateWeightedProgress(
      ["setActivityAsRunning", "generateSentences", "saveSentences"],
      "generateAudio",
      "listening",
    );

    expect(progress).toBeGreaterThan(0);
  });
});

describe("reading phase status", () => {
  test("activates buildingWordList for sentence generation", () => {
    const status = getPhaseStatus(
      "buildingWordList",
      ["setActivityAsRunning"],
      "generateSentences",
      "reading",
    );

    expect(status).toBe("active");
  });

  test("calculates progress for reading flow", () => {
    const progress = calculateWeightedProgress(
      ["setActivityAsRunning", "generateSentences", "saveSentences"],
      "generateAudio",
      "reading",
    );

    expect(progress).toBeGreaterThan(0);
  });
});

describe("custom phase status", () => {
  test("completes gettingStarted after getLessonActivities (getNeighboringConcepts is not used)", () => {
    const status = getPhaseStatus(
      "gettingStarted",
      ["getLessonActivities"],
      "setActivityAsRunning",
      "custom",
    );

    expect(status).toBe("completed");
  });
});

describe("quiz phase status", () => {
  test("does not include preparingVisuals or creatingImages phases", () => {
    const phases = getPhaseOrder("quiz");
    expect(phases).not.toContain("preparingVisuals");
    expect(phases).not.toContain("creatingImages");
  });
});

describe("enforcePhaseProgression integration", () => {
  test("clamps finishing to pending when creatingImages is still pending (explanation kind)", () => {
    const phaseOrder = getPhaseOrder("explanation");

    const rawPhases = phaseOrder.map((phase) => ({
      name: phase,
      status: getPhaseStatus(
        phase,
        [
          "getLessonActivities",
          "getNeighboringConcepts",
          "setActivityAsRunning",
          "generateExplanationContent",
          "generateVisuals",
          "setChallengeAsCompleted",
        ],
        null,
        "explanation",
      ),
    }));

    const enforced = enforcePhaseProgression(rawPhases);

    const finishing = enforced.find((item) => item.name === "finishing");
    const creatingImages = enforced.find((item) => item.name === "creatingImages");

    expect(creatingImages).toBeDefined();
    expect(creatingImages?.status).not.toBe("completed");
    expect(finishing?.status).toBe("pending");
  });
});
