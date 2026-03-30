import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateReadingAudioStep } from "../steps/generate-reading-audio-step";
import { generateReadingContentStep } from "../steps/generate-reading-content-step";
import { generateReadingRomanizationStep } from "../steps/generate-reading-romanization-step";
import { generateSentenceDistractorsStep } from "../steps/generate-sentence-distractors-step";
import { generateSentenceWordAudioStep } from "../steps/generate-sentence-word-audio-step";
import { generateSentenceWordMetadataStep } from "../steps/generate-sentence-word-metadata-step";
import { generateSentenceWordPronunciationStep } from "../steps/generate-sentence-word-pronunciation-step";
import { saveReadingActivityStep } from "../steps/save-reading-activity-step";
import { readingActivityWorkflow } from "./reading-workflow";

vi.mock("../steps/generate-reading-content-step", () => ({
  generateReadingContentStep: vi.fn().mockResolvedValue({
    sentences: [
      {
        explanation: "test explanation",
        sentence: "Guten Morgen, Lara.",
        translation: "Bom dia, Lara.",
      },
    ],
  }),
}));

vi.mock("../steps/generate-reading-audio-step", () => ({
  generateReadingAudioStep: vi.fn().mockResolvedValue({
    sentenceAudioUrls: { "Guten Morgen, Lara.": "/audio/sentence.mp3" },
  }),
}));

vi.mock("../steps/generate-reading-romanization-step", () => ({
  generateReadingRomanizationStep: vi.fn().mockResolvedValue({
    romanizations: { "Guten Morgen, Lara.": null },
  }),
}));

vi.mock("../steps/generate-sentence-distractors-step", () => ({
  generateSentenceDistractorsStep: vi.fn().mockResolvedValue({
    distractors: { "Guten Morgen, Lara.": ["Abend", "Fenster"] },
    translationDistractors: { "Bom dia, Lara.": ["tchau", "boa noite"] },
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

vi.mock("../steps/save-reading-activity-step", () => ({
  saveReadingActivityStep: vi.fn(async () => {}),
}));

function makeActivity(kind: string) {
  return { id: kind, kind };
}

describe(readingActivityWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("enriches canonical sentence words plus target-language distractors only", async () => {
    const activities = [makeActivity("reading")];
    const words = [{ translation: "hello", word: "hola" }];

    await readingActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      concepts: ["greetings"],
      neighboringConcepts: ["introductions"],
      words,
      workflowRunId: "workflow-1",
    });

    expect(generateReadingContentStep).toHaveBeenCalledWith(
      activities[0],
      "workflow-1",
      words,
      ["greetings"],
      ["introductions"],
    );
    expect(generateSentenceDistractorsStep).toHaveBeenCalledWith(activities, [
      {
        explanation: "test explanation",
        sentence: "Guten Morgen, Lara.",
        translation: "Bom dia, Lara.",
      },
    ]);
    expect(generateSentenceWordMetadataStep).toHaveBeenCalledWith(
      activities,
      [
        {
          explanation: "test explanation",
          sentence: "Guten Morgen, Lara.",
          translation: "Bom dia, Lara.",
        },
      ],
      ["guten", "morgen", "lara", "Abend", "Fenster"],
    );
    expect(generateSentenceWordAudioStep).toHaveBeenCalledWith(activities, [
      "guten",
      "morgen",
      "lara",
      "Abend",
      "Fenster",
    ]);
    expect(generateSentenceWordPronunciationStep).toHaveBeenCalledWith(activities, [
      "guten",
      "morgen",
      "lara",
      "Abend",
      "Fenster",
    ]);
    expect(saveReadingActivityStep).toHaveBeenCalledWith({
      activities,
      distractors: { "Guten Morgen, Lara.": ["Abend", "Fenster"] },
      pronunciations: {
        Abend: "abend",
        Fenster: "fenster",
        guten: "guten",
        lara: "lara",
        morgen: "morgen",
      },
      sentenceAudioUrls: { "Guten Morgen, Lara.": "/audio/sentence.mp3" },
      sentenceRomanizations: { "Guten Morgen, Lara.": null },
      sentences: [
        {
          explanation: "test explanation",
          sentence: "Guten Morgen, Lara.",
          translation: "Bom dia, Lara.",
        },
      ],
      translationDistractors: { "Bom dia, Lara.": ["tchau", "boa noite"] },
      wordAudioUrls: {
        Abend: "/audio/abend.mp3",
        Fenster: "/audio/fenster.mp3",
        guten: "/audio/guten.mp3",
        lara: "/audio/lara.mp3",
        morgen: "/audio/morgen.mp3",
      },
      wordMetadata: {
        Abend: { romanization: null, translation: "" },
        Fenster: { romanization: null, translation: "" },
        guten: { romanization: null, translation: "good" },
        lara: { romanization: null, translation: "Lara" },
        morgen: { romanization: null, translation: "morning" },
      },
      workflowRunId: "workflow-1",
    });
  });

  test("returns early when no reading activity needs generation", async () => {
    await readingActivityWorkflow({
      activitiesToGenerate: [] as never,
      allActivities: [makeActivity("reading")] as never,
      concepts: [],
      neighboringConcepts: [],
      words: [],
      workflowRunId: "workflow-2",
    });

    expect(generateReadingContentStep).not.toHaveBeenCalled();
    expect(saveReadingActivityStep).not.toHaveBeenCalled();
  });

  test("passes empty current-run vocabulary words to the content step", async () => {
    const activities = [makeActivity("reading")];

    await readingActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      concepts: ["greetings"],
      neighboringConcepts: ["introductions"],
      words: [],
      workflowRunId: "workflow-empty-words",
    });

    expect(generateReadingContentStep).toHaveBeenCalledWith(
      activities[0],
      "workflow-empty-words",
      [],
      ["greetings"],
      ["introductions"],
    );
  });

  test("falls back to empty enrichment maps when non-critical substeps fail", async () => {
    vi.mocked(generateReadingAudioStep).mockRejectedValueOnce(new Error("audio failed"));
    vi.mocked(generateReadingRomanizationStep).mockRejectedValueOnce(
      new Error("romanization failed"),
    );
    vi.mocked(generateSentenceWordAudioStep).mockRejectedValueOnce(new Error("tts failed"));
    vi.mocked(generateSentenceWordPronunciationStep).mockRejectedValueOnce(
      new Error("pronunciation failed"),
    );

    const activities = [makeActivity("reading")];

    await readingActivityWorkflow({
      activitiesToGenerate: activities as never,
      allActivities: activities as never,
      concepts: [],
      neighboringConcepts: [],
      words: [],
      workflowRunId: "workflow-3",
    });

    expect(saveReadingActivityStep).toHaveBeenCalledWith(
      expect.objectContaining({
        activities,
        pronunciations: {},
        sentenceAudioUrls: {},
        sentenceRomanizations: {},
        wordAudioUrls: {},
        workflowRunId: "workflow-3",
      }),
    );
  });
});
