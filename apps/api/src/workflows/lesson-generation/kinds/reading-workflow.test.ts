import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentenceDistractorsStep } from "../steps/generate-sentence-distractors-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { generateSentenceWordPronunciationStep } from "../steps/generate-sentence-word-pronunciation-step";
import { saveReadingLessonStep } from "../steps/save-reading-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { readingLessonWorkflow } from "./reading-workflow";

const { sentences, targetWords } = vi.hoisted(() => ({
  sentences: [
    {
      explanation: "Greeting sentence.",
      sentence: "Guten Morgen, Lara.",
      translation: "Good morning, Lara.",
    },
  ],
  targetWords: ["guten", "morgen", "lara", "Abend", "Fenster"],
}));

vi.mock("../steps/generate-reading-content-step", () => ({
  generateReadingContentStep: vi.fn().mockResolvedValue({
    kind: "reading",
    sentences,
  }),
}));

vi.mock("../steps/generate-reading-audio-step", () => ({
  generateReadingAudioStep: vi.fn().mockResolvedValue({
    sentenceAudioUrls: { "Guten Morgen, Lara.": "/audio/sentence.mp3" },
  }),
}));

vi.mock("../steps/generate-reading-romanization-step", () => ({
  generateReadingRomanizationStep: vi.fn().mockResolvedValue({
    romanizations: { "Guten Morgen, Lara.": "guten morgen lara" },
  }),
}));

vi.mock("../steps/generate-sentence-distractors-step", () => ({
  generateSentenceDistractorsStep: vi.fn().mockResolvedValue({
    distractors: { "Guten Morgen, Lara.": ["Abend", "Fenster"] },
    translationDistractors: { "Good morning, Lara.": ["good night", "goodbye"] },
  }),
}));

vi.mock("../steps/generate-sentence-word-metadata-step", () => ({
  generateSentenceWordMetadataStep: vi.fn().mockResolvedValue({
    wordMetadata: {
      Abend: { romanization: null, translation: "" },
      Fenster: { romanization: null, translation: "" },
      guten: { romanization: null, translation: "good" },
      lara: { romanization: null, translation: "Lara" },
      morgen: { romanization: null, translation: "morning" },
    },
  }),
}));

vi.mock("../steps/generate-sentence-word-audio-step", () => ({
  generateSentenceWordAudioStep: vi.fn().mockResolvedValue({
    wordAudioUrls: {
      Abend: "/audio/abend.mp3",
      Fenster: "/audio/fenster.mp3",
      guten: "/audio/guten.mp3",
      lara: "/audio/lara.mp3",
      morgen: "/audio/morgen.mp3",
    },
  }),
}));

vi.mock("../steps/generate-sentence-word-pronunciation-step", () => ({
  generateSentenceWordPronunciationStep: vi.fn().mockResolvedValue({
    pronunciations: {
      Abend: "abend",
      Fenster: "fenster",
      guten: "guten",
      lara: "lara",
      morgen: "morgen",
    },
  }),
}));

vi.mock("../steps/save-reading-lesson-step", () => ({
  saveReadingLessonStep: vi.fn(),
}));

describe(readingLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("enriches sentence words and distractors before saving reading content", async () => {
    const context = await createKindWorkflowContext();

    await readingLessonWorkflow(context);

    expect(generateReadingContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateReadingAudioStep).toHaveBeenCalledWith({ context, sentences });
    expect(generateReadingRomanizationStep).toHaveBeenCalledWith({ context, sentences });
    expect(generateSentenceDistractorsStep).toHaveBeenCalledWith({ context, sentences });
    expect(generateSentenceWordMetadataStep).toHaveBeenCalledWith({
      context,
      sentences,
      targetWords,
    });
    expect(generateSentenceWordAudioStep).toHaveBeenCalledWith({
      context,
      words: targetWords,
    });
    expect(generateSentenceWordPronunciationStep).toHaveBeenCalledWith({
      context,
      words: targetWords,
    });
    expect(saveReadingLessonStep).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        distractors: { "Guten Morgen, Lara.": ["Abend", "Fenster"] },
        sentences,
      }),
    );
  });
});
