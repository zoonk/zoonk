import { describe, expect, it } from "vitest";
import { type StepResult } from "../../player-reducer";
import { type SerializedStep } from "../../prepare-activity-data";
import { getFeedbackRomanization } from "./feedback-romanization";

/**
 * Builds a minimal StepResult with the given answer kind.
 * Only populates the fields that getFeedbackRomanization reads.
 */
function buildResult(answer?: StepResult["answer"]): StepResult {
  return {
    answer,
    effects: [],
    result: { correctAnswer: null, feedback: null, isCorrect: true },
    stepId: "step-1",
  };
}

/**
 * Builds a minimal SerializedStep with optional word/sentence romanization.
 * Only populates the fields that getFeedbackRomanization reads.
 */
function buildStep({
  sentenceRomanization,
  wordRomanization,
}: {
  sentenceRomanization?: string | null;
  wordRomanization?: string | null;
} = {}): SerializedStep {
  return {
    content: {},
    fillBlankOptions: [],
    id: "step-1",
    kind: "translation",
    matchColumnsRightItems: [],
    position: 0,
    sentence:
      sentenceRomanization === undefined
        ? null
        : {
            alternativeSentences: [],
            alternativeTranslations: [],
            audioUrl: null,
            explanation: null,
            id: "s-1",
            romanization: sentenceRomanization,
            sentence: "test sentence",
            translation: "test translation",
          },
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word:
      wordRomanization === undefined
        ? null
        : {
            alternativeTranslations: [],
            audioUrl: null,
            id: "w-1",
            pronunciation: null,
            romanization: wordRomanization,
            translation: "hello",
            word: "こんにちは",
          },
    wordBankOptions: [],
  };
}

describe(getFeedbackRomanization, () => {
  describe("reading answers (sentence romanization)", () => {
    it("returns sentence romanization on correct reading when it differs from selected text", () => {
      const result = buildResult({ arrangedWords: ["こんにちは", "世界"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "konnichiwa sekai" });

      const rom = getFeedbackRomanization(result, step, "こんにちは 世界", null, null);

      expect(rom.correctReading).toBe("konnichiwa sekai");
    });

    it("returns null correctReading when romanization matches selected text (dedup)", () => {
      const result = buildResult({ arrangedWords: ["hello", "world"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "hello world" });

      const rom = getFeedbackRomanization(result, step, "hello world", null, null);

      expect(rom.correctReading).toBeNull();
    });

    it("returns sentence romanization on wrong reading correctAnswer line", () => {
      const result = buildResult({ arrangedWords: ["世界", "こんにちは"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "konnichiwa sekai" });

      const rom = getFeedbackRomanization(result, step, null, "こんにちは 世界", null);

      expect(rom.wrongReading).toBe("konnichiwa sekai");
    });

    it("returns null wrongReading when romanization matches correct answer (dedup)", () => {
      const result = buildResult({ arrangedWords: ["world", "hello"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "hello world" });

      const rom = getFeedbackRomanization(result, step, null, "hello world", null);

      expect(rom.wrongReading).toBeNull();
    });
  });

  describe("translation answers (word romanization)", () => {
    it("returns word romanization on correct translation answer", () => {
      const result = buildResult({
        kind: "translation",
        questionText: "hello",
        selectedText: "こんにちは",
        selectedWordId: "w-1",
      });
      const step = buildStep({ wordRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, "こんにちは", null, "hello");

      expect(rom.correctReading).toBe("konnichiwa");
    });

    it("returns null when word romanization matches selected text (dedup)", () => {
      const result = buildResult({
        kind: "translation",
        questionText: "hello",
        selectedText: "konnichiwa",
        selectedWordId: "w-1",
      });
      const step = buildStep({ wordRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, "konnichiwa", null, "hello");

      expect(rom.correctReading).toBeNull();
    });

    it("returns word romanization on wrong translation's correct answer line", () => {
      const result = buildResult({
        kind: "translation",
        questionText: "hello",
        selectedText: "さようなら",
        selectedWordId: "w-2",
      });
      const step = buildStep({ wordRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, "さようなら", "こんにちは", "hello");

      expect(rom.wrongReading).toBe("konnichiwa");
    });

    it("returns null wrongReading when word romanization matches correct answer (dedup)", () => {
      const result = buildResult({
        kind: "translation",
        questionText: "hello",
        selectedText: "wrong",
        selectedWordId: "w-2",
      });
      const step = buildStep({ wordRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, "wrong", "konnichiwa", "hello");

      expect(rom.wrongReading).toBeNull();
    });

    it("returns null for translate field (only used by listening)", () => {
      const result = buildResult({
        kind: "translation",
        questionText: "hello",
        selectedText: "こんにちは",
        selectedWordId: "w-1",
      });
      const step = buildStep({ wordRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, "こんにちは", null, "hello");

      expect(rom.translate).toBeNull();
    });

    it("returns null when step has no word", () => {
      const result = buildResult({
        kind: "translation",
        questionText: "hello",
        selectedText: "こんにちは",
        selectedWordId: "w-1",
      });
      const step = buildStep();

      const rom = getFeedbackRomanization(result, step, "こんにちは", null, "hello");

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
    });
  });

  describe("listening answers", () => {
    it("returns sentence romanization for translate line", () => {
      const result = buildResult({ arrangedWords: ["hello", "world"], kind: "listening" });
      const step = buildStep({ sentenceRomanization: "konnichiwa sekai" });

      const rom = getFeedbackRomanization(result, step, null, null, "こんにちは 世界");

      expect(rom.translate).toBe("konnichiwa sekai");
    });

    it("returns null translate when romanization matches question text (dedup)", () => {
      const result = buildResult({ arrangedWords: ["hello"], kind: "listening" });
      const step = buildStep({ sentenceRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, null, null, "konnichiwa");

      expect(rom.translate).toBeNull();
    });

    it("returns null for correctReading and wrongReading", () => {
      const result = buildResult({ arrangedWords: ["hello"], kind: "listening" });
      const step = buildStep({ sentenceRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization(result, step, "hello", "world", "こんにちは");

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
    });
  });

  describe("multipleChoice answers", () => {
    it("returns null for all fields", () => {
      const result = buildResult({
        kind: "multipleChoice",
        selectedIndex: 0,
        selectedText: "option A",
      });
      const step = buildStep({ sentenceRomanization: "romaji", wordRomanization: "romaji" });

      const rom = getFeedbackRomanization(result, step, "option A", null, null);

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
      expect(rom.translate).toBeNull();
    });
  });

  describe("no answer", () => {
    it("returns null for all fields when answer is undefined", () => {
      const result = buildResult();
      const step = buildStep({ sentenceRomanization: "romaji", wordRomanization: "romaji" });

      const rom = getFeedbackRomanization(result, step, null, null, null);

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
      expect(rom.translate).toBeNull();
    });
  });
});
