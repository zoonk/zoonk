import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyDistractorsStep } from "../steps/generate-vocabulary-distractors-step";
import { generateVocabularyPronunciationStep } from "../steps/generate-vocabulary-pronunciation-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { saveTranslationFromExistingVocabularyStep } from "../steps/save-translation-from-existing-vocabulary-step";
import { saveVocabularyActivityStep } from "../steps/save-vocabulary-activity-step";
import { vocabularyActivityWorkflow } from "./vocabulary-workflow";

vi.mock("../handle-activity-workflow-error", () => ({
  failActivityWorkflows: vi.fn(async ({ error }: { error: unknown }) => {
    throw error;
  }),
}));

vi.mock("../steps/generate-vocabulary-content-step", () => ({
  generateVocabularyContentStep: vi.fn().mockResolvedValue({
    words: [{ translation: "good evening", word: "boa noite" }],
  }),
}));

vi.mock("../steps/generate-vocabulary-distractors-step", () => ({
  generateVocabularyDistractorsStep: vi.fn().mockResolvedValue({
    distractors: {
      "boa noite": ["boa tarde", "bom dia", "boa tarde"],
    },
  }),
}));

vi.mock("../steps/generate-vocabulary-pronunciation-step", () => ({
  generateVocabularyPronunciationStep: vi.fn().mockResolvedValue({
    pronunciations: {
      "boa noite": "pron-boa-noite",
      "boa tarde": "pron-boa-tarde",
      "bom dia": "pron-bom-dia",
    },
  }),
}));

vi.mock("../steps/generate-vocabulary-audio-step", () => ({
  generateVocabularyAudioStep: vi.fn().mockResolvedValue({
    wordAudioUrls: {
      "boa noite": "/audio/boa-noite.mp3",
      "boa tarde": "/audio/boa-tarde.mp3",
      "bom dia": "/audio/bom-dia.mp3",
    },
  }),
}));

vi.mock("../steps/generate-vocabulary-romanization-step", () => ({
  generateVocabularyRomanizationStep: vi.fn().mockResolvedValue({
    romanizations: {},
  }),
}));

vi.mock("../steps/save-translation-from-existing-vocabulary-step", () => ({
  saveTranslationFromExistingVocabularyStep: vi.fn(async () => {}),
}));

vi.mock("../steps/save-vocabulary-activity-step", () => ({
  saveVocabularyActivityStep: vi.fn(async () => {}),
}));

function makeActivity(kind: string) {
  return { id: kind, kind };
}

describe(vocabularyActivityWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("collects canonical and distractor target words for enrichment", async () => {
    const activities = [makeActivity("vocabulary"), makeActivity("translation")];

    const result = await vocabularyActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      concepts: ["greetings"],
      neighboringConcepts: ["introductions"],
      workflowRunId: "workflow-1",
    });

    expect(result.words).toEqual([{ translation: "good evening", word: "boa noite" }]);
    expect(generateVocabularyContentStep).toHaveBeenCalledWith(
      activities[0],
      "workflow-1",
      ["greetings"],
      ["introductions"],
    );
    expect(generateVocabularyDistractorsStep).toHaveBeenCalledWith(activities, result.words);
    expect(generateVocabularyPronunciationStep).toHaveBeenCalledWith(activities, [
      "boa noite",
      "boa tarde",
      "bom dia",
    ]);
    expect(generateVocabularyAudioStep).toHaveBeenCalledWith(activities, [
      "boa noite",
      "boa tarde",
      "bom dia",
    ]);
    expect(generateVocabularyRomanizationStep).toHaveBeenCalledWith(activities, [
      "boa noite",
      "boa tarde",
      "bom dia",
    ]);
    expect(saveVocabularyActivityStep).toHaveBeenCalledWith({
      activities,
      distractors: { "boa noite": ["boa tarde", "bom dia", "boa tarde"] },
      pronunciations: {
        "boa noite": "pron-boa-noite",
        "boa tarde": "pron-boa-tarde",
        "bom dia": "pron-bom-dia",
      },
      romanizations: {},
      wordAudioUrls: {
        "boa noite": "/audio/boa-noite.mp3",
        "boa tarde": "/audio/boa-tarde.mp3",
        "bom dia": "/audio/bom-dia.mp3",
      },
      words: [{ translation: "good evening", word: "boa noite" }],
      workflowRunId: "workflow-1",
    });
  });

  test("reuses existing vocabulary when only translation needs generation", async () => {
    const activitiesToGenerate = [makeActivity("translation")];
    const allActivities = [makeActivity("vocabulary"), makeActivity("translation")];

    const result = await vocabularyActivityWorkflow({
      activitiesToGenerate: activitiesToGenerate as never,
      allActivities: allActivities as never,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "workflow-2",
    });

    expect(result).toEqual({ words: [] });
    expect(saveTranslationFromExistingVocabularyStep).toHaveBeenCalledWith({
      allActivities,
      workflowRunId: "workflow-2",
    });
    expect(generateVocabularyContentStep).not.toHaveBeenCalled();
    expect(saveVocabularyActivityStep).not.toHaveBeenCalled();
  });

  test("returns early when neither vocabulary nor translation need generation", async () => {
    const allActivities = [makeActivity("vocabulary"), makeActivity("translation")];

    const result = await vocabularyActivityWorkflow({
      activitiesToGenerate: [] as never,
      allActivities: allActivities as never,
      concepts: [],
      neighboringConcepts: [],
      workflowRunId: "workflow-noop",
    });

    expect(result).toEqual({ words: [] });
    expect(generateVocabularyContentStep).not.toHaveBeenCalled();
    expect(saveTranslationFromExistingVocabularyStep).not.toHaveBeenCalled();
    expect(saveVocabularyActivityStep).not.toHaveBeenCalled();
  });

  test("throws when enrichment steps fail", async () => {
    const activities = [makeActivity("vocabulary"), makeActivity("translation")];

    vi.mocked(generateVocabularyPronunciationStep).mockRejectedValueOnce(
      new Error("pronunciation failed"),
    );
    vi.mocked(generateVocabularyAudioStep).mockRejectedValueOnce(new Error("audio failed"));
    vi.mocked(generateVocabularyRomanizationStep).mockRejectedValueOnce(
      new Error("romanization failed"),
    );

    await expect(
      vocabularyActivityWorkflow({
        activitiesToGenerate: activities as never,
        allActivities: activities as never,
        concepts: [],
        neighboringConcepts: [],
        workflowRunId: "workflow-3",
      }),
    ).rejects.toThrow("pronunciation failed");

    expect(saveVocabularyActivityStep).not.toHaveBeenCalled();
  });
});
