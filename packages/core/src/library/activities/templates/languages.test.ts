import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { checkActivityAnswer } from "../activity-answers";
import { activityContentSchema } from "../activity-templates";
import { validateActivity } from "../validate-activity";
import { patternEnding, sentenceEdges, sentenceKey, sentenceTiles } from "./_utils/language";

const fixtures = activityContentFixtures;

function issueCodes(content: unknown): string[] {
  const result = validateActivity(content);
  return result.ok ? [] : result.issues.map((item) => item.code);
}

describe("sentence tiles", () => {
  it("keeps words and drops the punctuation around them", () => {
    expect(sentenceTiles(" ¿Venís a cenar  esta noche? ")).toStrictEqual([
      "Venís",
      "a",
      "cenar",
      "esta",
      "noche",
    ]);

    expect(sentenceTiles("Qu'est-ce que c'est ?")).toStrictEqual(["Qu'est-ce", "que", "c'est"]);
    expect(sentenceTiles("«Hola», dijo.")).toStrictEqual(["Hola", "dijo"]);
  });

  it("compares sentences by their words, whatever the case, spacing or punctuation", () => {
    expect(sentenceKey("¿Venís a cenar esta noche?")).toBe(sentenceKey("venís a cenar esta noche"));
    expect(sentenceKey("¿Venís a cenar?")).not.toBe(sentenceKey("¿Vienen a cenar?"));
  });

  it("finds the punctuation a sentence opens and closes with", () => {
    expect(sentenceEdges("¿Venís a cenar?")).toStrictEqual({ end: "?", start: "¿" });
    expect(sentenceEdges("I'm coming.")).toStrictEqual({ end: ".", start: "" });
    expect(sentenceEdges("Hola")).toStrictEqual({ end: "", start: "" });
  });

  it("picks the longest ending a pattern answer finishes with", () => {
    expect(patternEnding(["os", "emos", "o"], "comemos")).toBe("emos");
    expect(patternEnding(["áis", "éis"], "coméis")).toBe("éis");
    expect(patternEnding(["áis"], "coméis")).toBeNull();
  });
});

describe("sentence builder", () => {
  const sentence = activityContentSchema.parse(fixtures.sentenceBuilder);

  it("grades the words built, not the punctuation or case", () => {
    expect(checkActivityAnswer(sentence, { kind: "text", text: "Venís a cenar esta noche" })).toBe(
      true,
    );

    expect(checkActivityAnswer(sentence, { kind: "text", text: "esta noche Venís a cenar" })).toBe(
      true,
    );

    expect(checkActivityAnswer(sentence, { kind: "text", text: "Vienen a cenar esta noche" })).toBe(
      false,
    );
  });

  it("rejects distractors that are part of the answer or more than one word", () => {
    const inAnswer = structuredClone(fixtures.sentenceBuilder);
    inAnswer.fields.distractors = [{ why: "It's in the answer.", word: "noche" }];

    const twoWords = structuredClone(fixtures.sentenceBuilder);
    twoWords.fields.distractors = [{ why: "Two words.", word: "la cena" }];

    expect(issueCodes(inAnswer)).toContain("inconsistentFields");
    expect(issueCodes(twoWords)).toContain("inconsistentFields");
  });

  it("rejects a variant the tiles can't build", () => {
    const variant = structuredClone(fixtures.sentenceBuilder);
    variant.fields.acceptedVariants = ["¿Queréis venir a cenar?"];

    expect(issueCodes(variant)).toContain("inconsistentFields");
  });
});

describe("pattern table", () => {
  it("expects each blank's ending, keyed by its row", () => {
    const table = activityContentSchema.parse(fixtures.patternTable);

    expect(
      checkActivityAnswer(table, { kind: "assignment", pairs: { "4": "éis", "5": "en" } }),
    ).toBe(true);

    expect(
      checkActivityAnswer(table, { kind: "assignment", pairs: { "4": "áis", "5": "en" } }),
    ).toBe(false);
  });

  it("rejects a blank whose ending is its whole answer", () => {
    const whole = structuredClone(fixtures.patternTable);
    whole.fields.choices = [...whole.fields.choices, "comen"];

    expect(issueCodes(whole)).toContain("inconsistentFields");
  });
});

describe("dialogue simulator and listening", () => {
  it("rejects a dialogue with two best replies", () => {
    const twoBest = structuredClone(fixtures.dialogueSimulator);
    twoBest.fields.replies = twoBest.fields.replies.map((reply) => ({ ...reply, isBest: true }));

    expect(issueCodes(twoBest)).toContain("inconsistentFields");
  });

  it("rejects listening speeds without normal speed or listed twice", () => {
    const slowOnly = structuredClone(fixtures.listeningSpeed);
    slowOnly.fields.speeds = [0.5, 0.75];

    const twice = structuredClone(fixtures.listeningSpeed);
    twice.fields.speeds = [0.75, 0.75, 1];

    expect(issueCodes(slowOnly)).toContain("inconsistentFields");
    expect(issueCodes(twice)).toContain("inconsistentFields");
  });
});
