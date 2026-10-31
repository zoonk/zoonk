import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { checkActivityAnswer } from "../activity-answers";
import { activityContentSchema } from "../activity-templates";
import { validateActivity } from "../validate-activity";
import { patternEnding, sentenceKey } from "./_utils/language";

const fixtures = activityContentFixtures;

function issueCodes(content: unknown): string[] {
  const result = validateActivity(content);
  return result.ok ? [] : result.issues.map((item) => item.code);
}

describe("language helpers", () => {
  it("compares sentences by their words, whatever the case, spacing or punctuation", () => {
    expect(sentenceKey("¿Venís a cenar esta noche?")).toBe(
      sentenceKey("venís a cenar  esta noche"),
    );

    expect(sentenceKey("¿Venís a cenar?")).not.toBe(sentenceKey("¿Vienen a cenar?"));
  });

  it("picks the longest ending a pattern answer finishes with", () => {
    expect(patternEnding(["os", "emos", "o"], "comemos")).toBe("emos");
    expect(patternEnding(["áis", "éis"], "coméis")).toBe("éis");
    expect(patternEnding(["áis"], "coméis")).toBeNull();
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

describe("dialogue simulator", () => {
  it("rejects a dialogue with two best replies", () => {
    const twoBest = structuredClone(fixtures.dialogueSimulator);
    twoBest.fields.replies = twoBest.fields.replies.map((reply) => ({ ...reply, isBest: true }));

    expect(issueCodes(twoBest)).toContain("inconsistentFields");
  });
});
