import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, it } from "vitest";
import { type StepResult } from "../../player-reducer";
import { getFeedbackRomanization } from "./feedback-romanization";

/**
 * Builds a minimal StepResult with the given answer kind.
 * Only populates the fields that getFeedbackRomanization reads.
 */
function buildResult(answer?: StepResult["answer"]): StepResult {
  return {
    answer,
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
            audioUrl: null,
            distractors: [],
            explanation: null,
            id: "s-1",
            romanization: sentenceRomanization,
            sentence: "test sentence",
            translation: "test translation",
            translationDistractors: [],
          },
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word:
      wordRomanization === undefined
        ? null
        : {
            audioUrl: null,
            distractors: [],
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

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: null,
        result,
        selectedText: "こんにちは 世界",
        step,
      });

      expect(rom.correctReading).toBe("konnichiwa sekai");
    });

    it("returns null correctReading when romanization matches selected text (dedup)", () => {
      const result = buildResult({ arrangedWords: ["hello", "world"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "hello world" });

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: null,
        result,
        selectedText: "hello world",
        step,
      });

      expect(rom.correctReading).toBeNull();
    });

    it("returns sentence romanization on wrong reading correctAnswer line", () => {
      const result = buildResult({ arrangedWords: ["世界", "こんにちは"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "konnichiwa sekai" });

      const rom = getFeedbackRomanization({
        correctAnswer: "こんにちは 世界",
        questionText: null,
        result,
        selectedText: null,
        step,
      });

      expect(rom.wrongReading).toBe("konnichiwa sekai");
    });

    it("returns null wrongReading when romanization matches correct answer (dedup)", () => {
      const result = buildResult({ arrangedWords: ["world", "hello"], kind: "reading" });
      const step = buildStep({ sentenceRomanization: "hello world" });

      const rom = getFeedbackRomanization({
        correctAnswer: "hello world",
        questionText: null,
        result,
        selectedText: null,
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: "hello",
        result,
        selectedText: "こんにちは",
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: "hello",
        result,
        selectedText: "konnichiwa",
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: "こんにちは",
        questionText: "hello",
        result,
        selectedText: "さようなら",
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: "konnichiwa",
        questionText: "hello",
        result,
        selectedText: "wrong",
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: "hello",
        result,
        selectedText: "こんにちは",
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: "hello",
        result,
        selectedText: "こんにちは",
        step,
      });

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
    });
  });

  describe("listening answers", () => {
    it("returns sentence romanization for translate line", () => {
      const result = buildResult({ arrangedWords: ["hello", "world"], kind: "listening" });
      const step = buildStep({ sentenceRomanization: "konnichiwa sekai" });

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: "こんにちは 世界",
        result,
        selectedText: null,
        step,
      });

      expect(rom.translate).toBe("konnichiwa sekai");
    });

    it("returns null translate when romanization matches question text (dedup)", () => {
      const result = buildResult({ arrangedWords: ["hello"], kind: "listening" });
      const step = buildStep({ sentenceRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: "konnichiwa",
        result,
        selectedText: null,
        step,
      });

      expect(rom.translate).toBeNull();
    });

    it("returns null for correctReading and wrongReading", () => {
      const result = buildResult({ arrangedWords: ["hello"], kind: "listening" });
      const step = buildStep({ sentenceRomanization: "konnichiwa" });

      const rom = getFeedbackRomanization({
        correctAnswer: "world",
        questionText: "こんにちは",
        result,
        selectedText: "hello",
        step,
      });

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

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: null,
        result,
        selectedText: "option A",
        step,
      });

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
      expect(rom.translate).toBeNull();
    });
  });

  describe("no answer", () => {
    it("returns null for all fields when answer is undefined", () => {
      const result = buildResult();
      const step = buildStep({ sentenceRomanization: "romaji", wordRomanization: "romaji" });

      const rom = getFeedbackRomanization({
        correctAnswer: null,
        questionText: null,
        result,
        selectedText: null,
        step,
      });

      expect(rom.correctReading).toBeNull();
      expect(rom.wrongReading).toBeNull();
      expect(rom.translate).toBeNull();
    });
  });
});
