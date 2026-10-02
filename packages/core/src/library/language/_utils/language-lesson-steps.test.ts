import { describe, expect, it } from "vitest";
import { parseStepContent } from "../../steps/contract/step-contract";
import { languageLessonDraft } from "../_test-utils/language-lesson-draft";
import { buildLanguageLessonSteps } from "./language-lesson-steps";

const WORD_IDS = ["word-rent", "word-deposit", "word-utilities"];
const SENTENCE_IDS = ["sentence-rent", "sentence-deposit", "sentence-utilities"];

function build(content = languageLessonDraft()) {
  return buildLanguageLessonSteps({
    content,
    sentenceIds: SENTENCE_IDS,
    targetLanguage: "en",
    wordIds: WORD_IDS,
  });
}

describe(buildLanguageLessonSteps, () => {
  it("lays the lesson out in the session rhythm", () => {
    expect(build().map((step) => step.kind)).toStrictEqual([
      "vocabulary",
      "vocabulary",
      "vocabulary",
      "translation",
      "translation",
      "translation",
      "explanation",
      "fillBlank",
      "reading",
      "reading",
      "listening",
      "spokenAnswer",
      "spokenAnswer",
      "typedAnswer",
      "summary",
    ]);
  });

  it("stores every screen in the step contract", () => {
    for (const step of build()) {
      expect(() => parseStepContent(step.kind, step.content)).not.toThrow();
    }
  });

  it("points word and sentence screens at their shared rows", () => {
    const steps = build();

    expect(
      steps.filter((step) => step.kind === "vocabulary").map((step) => step.wordId),
    ).toStrictEqual(WORD_IDS);

    expect(
      steps.filter((step) => step.kind === "translation").map((step) => step.wordId),
    ).toStrictEqual(["word-deposit", "word-utilities", "word-rent"]);

    expect(
      steps.filter((step) => step.sentenceId).map((step) => [step.kind, step.sentenceId]),
    ).toStrictEqual([
      ["reading", "sentence-rent"],
      ["reading", "sentence-deposit"],
      ["listening", "sentence-utilities"],
      ["spokenAnswer", "sentence-rent"],
      ["spokenAnswer", "sentence-utilities"],
    ]);
  });

  it("asks the learner to say the sentence in the target language, with its translation", () => {
    const spoken = build().find((step) => step.kind === "spokenAnswer");

    expect(spoken?.content).toStrictEqual({
      language: "en",
      prompt: "Pergunte quanto é o aluguel.",
      targetText: "How much is the rent?",
      translation: "Quanto é o aluguel?",
    });
  });

  it("puts the tip's examples under its text", () => {
    const tip = build().find((step) => step.kind === "explanation");

    expect(tip?.content).toStrictEqual({
      text: "Use `how much is` para uma coisa e `how much are` para várias.\n\n- `How much is the rent?`: Quanto é o aluguel?\n- `How much are the utilities?`: Quanto são as contas?",
      title: "Perguntar preços com how much",
    });
  });

  it("leaves out a screen too long for the contract instead of storing it broken", () => {
    const draft = languageLessonDraft();
    const longSentence = `${"very ".repeat(40)}long sentence`;

    const steps = build({
      ...draft,
      sentences: draft.sentences.map((sentence) => ({ ...sentence, sentence: longSentence })),
    });

    expect(steps.some((step) => step.kind === "spokenAnswer")).toBe(false);
    expect(steps.filter((step) => step.kind === "reading")).toHaveLength(2);
  });
});
