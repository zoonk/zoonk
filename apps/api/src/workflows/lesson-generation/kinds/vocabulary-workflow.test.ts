import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateVocabularyAudioStep } from "../steps/generate-vocabulary-audio-step";
import { generateVocabularyContentStep } from "../steps/generate-vocabulary-content-step";
import { generateVocabularyDistractorsStep } from "../steps/generate-vocabulary-distractors-step";
import { generateVocabularyPronunciationStep } from "../steps/generate-vocabulary-pronunciation-step";
import { generateVocabularyRomanizationStep } from "../steps/generate-vocabulary-romanization-step";
import { saveVocabularyLessonStep } from "../steps/save-vocabulary-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { vocabularyLessonWorkflow } from "./vocabulary-workflow";

const { distractors, enrichedWords, vocabularyWords } = vi.hoisted(() => ({
  distractors: { "boa noite": ["boa tarde", "bom dia", "boa tarde"] },
  enrichedWords: ["boa noite", "boa tarde", "bom dia"],
  vocabularyWords: [{ translation: "good evening", word: "boa noite" }],
}));

vi.mock("../steps/generate-vocabulary-content-step", () => ({
  generateVocabularyContentStep: vi.fn().mockResolvedValue({
    kind: "vocabulary",
    words: vocabularyWords,
  }),
}));

vi.mock("../steps/generate-vocabulary-distractors-step", () => ({
  generateVocabularyDistractorsStep: vi.fn().mockResolvedValue({ distractors }),
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

vi.mock("../steps/save-vocabulary-lesson-step", () => ({
  saveVocabularyLessonStep: vi.fn(),
}));

describe(vocabularyLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("enriches vocabulary words and distractors before saving vocabulary", async () => {
    const context = await createKindWorkflowContext();

    await vocabularyLessonWorkflow(context);

    expect(generateVocabularyContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateVocabularyDistractorsStep).toHaveBeenCalledWith({
      context,
      words: vocabularyWords,
    });
    expect(generateVocabularyPronunciationStep).toHaveBeenCalledWith({
      context,
      words: enrichedWords,
    });
    expect(generateVocabularyAudioStep).toHaveBeenCalledWith({
      context,
      words: enrichedWords,
    });
    expect(generateVocabularyRomanizationStep).toHaveBeenCalledWith({
      context,
      words: enrichedWords,
    });
    expect(saveVocabularyLessonStep).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        distractors,
      }),
    );
  });
});
