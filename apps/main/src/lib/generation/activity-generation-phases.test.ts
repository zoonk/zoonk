import { enforcePhaseProgression } from "@/lib/generation-phases";
import { getPhaseOrder } from "@/lib/generation/activity-generation-phase-config";
import { describe, expect, test } from "vitest";
import { getPhaseStatus } from "./activity-generation-phases";

describe("vocabulary phase status", () => {
  test("activates buildingWordList for vocabulary content steps", () => {
    const status = getPhaseStatus(
      "buildingWordList",
      ["getLessonActivities"],
      "generateVocabularyContent",
      "vocabulary",
    );

    expect(status).toBe("active");
  });
});

describe("grammar phase status", () => {
  test("activates writingContent for grammar generation", () => {
    const status = getPhaseStatus(
      "writingContent",
      ["getLessonActivities"],
      "generateGrammarContent",
      "grammar",
    );

    expect(status).toBe("active");
  });

  test("activates creatingExercises for grammar user content", () => {
    const status = getPhaseStatus(
      "creatingExercises",
      ["getLessonActivities", "generateGrammarContent"],
      "generateGrammarUserContent",
      "grammar",
    );

    expect(status).toBe("active");
  });
});

describe("listening phase status", () => {
  test("activates buildingWordList for generateVocabularyContent in listening", () => {
    const status = getPhaseStatus(
      "buildingWordList",
      ["getLessonActivities"],
      "generateVocabularyContent",
      "listening",
    );

    expect(status).toBe("active");
  });

  test("keeps saving pending during early dependency processing", () => {
    const status = getPhaseStatus(
      "saving",
      ["getLessonActivities", "generateVocabularyContent"],
      "generateGrammarContent",
      "listening",
    );

    expect(status).toBe("pending");
  });

  test("activates creatingSentences for generateSentences in listening", () => {
    const status = getPhaseStatus(
      "creatingSentences",
      [
        "getLessonActivities",
        "generateVocabularyContent",
        "generateVocabularyDistractors",
        "generateVocabularyPronunciation",
        "generateVocabularyAudio",
        "saveVocabularyActivity",
        "generateGrammarContent",
        "saveGrammarActivity",
      ],
      "generateSentences",
      "listening",
    );

    expect(status).toBe("active");
  });

  test("keeps sentence distractors in their own listening phase", () => {
    const status = getPhaseStatus(
      "creatingAnswerOptions",
      [
        "getLessonActivities",
        "generateVocabularyContent",
        "generateVocabularyDistractors",
        "generateVocabularyPronunciation",
        "generateVocabularyAudio",
        "saveVocabularyActivity",
        "generateGrammarContent",
        "generateGrammarUserContent",
        "saveGrammarActivity",
        "generateSentences",
      ],
      "generateSentenceDistractors",
      "listening",
    );

    expect(status).toBe("active");
  });
});

describe("reading phase status", () => {
  test("activates creatingSentences for sentence generation", () => {
    const status = getPhaseStatus(
      "creatingSentences",
      ["getLessonActivities"],
      "generateSentences",
      "reading",
    );

    expect(status).toBe("active");
  });

  test("activates lookingUpWords for word metadata generation", () => {
    const status = getPhaseStatus(
      "lookingUpWords",
      ["getLessonActivities", "generateSentences", "generateAudio"],
      "generateSentenceWordMetadata",
      "reading",
    );

    expect(status).toBe("active");
  });
});

describe("custom phase status", () => {
  test("completes gettingStarted after getLessonActivities and setActivityAsRunning", () => {
    const status = getPhaseStatus(
      "gettingStarted",
      ["getLessonActivities", "setActivityAsRunning"],
      "generateCustomContent",
      "custom",
    );

    expect(status).toBe("completed");
  });
});

describe("enforcePhaseProgression integration", () => {
  test("clamps saving to pending when creatingImages is still pending (explanation kind)", () => {
    const phaseOrder = getPhaseOrder("explanation");

    const rawPhases = phaseOrder.map((phase) => ({
      name: phase,
      status: getPhaseStatus(
        phase,
        [
          "getLessonActivities",
          "getNeighboringConcepts",
          "generateExplanationContent",
          "generateVisuals",
        ],
        null,
        "explanation",
      ),
    }));

    const enforced = enforcePhaseProgression(rawPhases);

    const saving = enforced.find((item) => item.name === "saving");
    const creatingImages = enforced.find((item) => item.name === "creatingImages");

    expect(creatingImages).toBeDefined();
    expect(creatingImages?.status).not.toBe("completed");
    expect(saving?.status).toBe("pending");
  });
});
