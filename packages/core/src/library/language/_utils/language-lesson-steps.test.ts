import { describe, expect, it } from "vitest";
import { parseStepContent } from "../../steps/contract/step-contract";
import {
  languageDialogue,
  languageLessonDraft,
  languagePatternTable,
  sameLanguageLessonDraft,
} from "../_test-utils/language-lesson-draft";
import { buildLanguageLessonSteps } from "./language-lesson-steps";

const WORD_IDS = ["word-rent", "word-deposit", "word-utilities"];
const SENTENCE_IDS = ["sentence-rent", "sentence-deposit", "sentence-utilities"];

function build(content = languageLessonDraft(), learnerLanguage = "pt") {
  return buildLanguageLessonSteps({
    content,
    learnerLanguage,
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

  it("keeps a long sentence's screens, since a length is only a target", () => {
    const draft = languageLessonDraft();
    const longSentence = `${"very ".repeat(40)}long sentence`;

    const steps = build({
      ...draft,
      sentences: draft.sentences.map((sentence) => ({ ...sentence, sentence: longSentence })),
    });

    expect(steps.map((step) => step.kind)).toStrictEqual(build(draft).map((step) => step.kind));
  });

  it("in the learner's own language, hears and builds every sentence instead of translating it", () => {
    const steps = build(sameLanguageLessonDraft(), "en");

    expect(steps.map((step) => step.kind)).toStrictEqual([
      "vocabulary",
      "vocabulary",
      "vocabulary",
      "translation",
      "translation",
      "translation",
      "explanation",
      "fillBlank",
      "listening",
      "listening",
      "listening",
      "spokenAnswer",
      "typedAnswer",
      "summary",
    ]);

    expect(steps.find((step) => step.kind === "spokenAnswer")?.content).toStrictEqual({
      language: "en",
      prompt: "Read the fact about plants aloud.",
      targetText: "Plants need water to grow",
    });

    expect(steps.find((step) => step.kind === "explanation")?.content).toStrictEqual({
      text: "After a plural subject like `plants`, the verb has no -s.\n\n- `Plants need water`\n- `Do plants need light?`",
      title: "Verbs after plural subjects",
    });
  });

  it("shows the pattern table after the tip and the dialogue before the learner speaks", () => {
    const steps = build(
      languageLessonDraft({ dialogue: languageDialogue(), patternTable: languagePatternTable() }),
    );

    expect(steps.map((step) => step.kind)).toStrictEqual([
      "vocabulary",
      "vocabulary",
      "vocabulary",
      "translation",
      "translation",
      "translation",
      "explanation",
      "activity",
      "fillBlank",
      "reading",
      "reading",
      "listening",
      "activity",
      "spokenAnswer",
      "spokenAnswer",
      "typedAnswer",
      "summary",
    ]);

    expect(
      steps.filter((step) => step.kind === "activity").map((step) => step.content),
    ).toMatchObject([
      { check: { kind: "interaction" }, template: "patternTable" },
      {
        check: { kind: "interaction" },
        fields: {
          language: "en",
          replies: [{ id: "reply-1" }, { id: "reply-2" }, { id: "reply-3" }],
        },
        template: "dialogueSimulator",
      },
    ]);
  });

  it("leaves out a pattern meaning the learner doesn't need", () => {
    const table = languagePatternTable({ modelMeaning: null, newMeaning: null });
    const steps = build(sameLanguageLessonDraft({ patternTable: table }), "en");
    const activity = steps.find((step) => step.kind === "activity");

    expect(activity?.content).toMatchObject({ template: "patternTable" });
    expect(activity?.content).not.toHaveProperty("fields.modelMeaning");
    expect(activity?.content).not.toHaveProperty("fields.newMeaning");
  });

  it("leaves out a dialogue whose replies don't have exactly one best", () => {
    const dialogue = languageDialogue();

    const steps = build(
      languageLessonDraft({
        dialogue: {
          ...dialogue,
          replies: dialogue.replies.map((reply) => ({ ...reply, isBest: true })),
        },
      }),
    );

    expect(steps.some((step) => step.kind === "activity")).toBe(false);
  });
});
