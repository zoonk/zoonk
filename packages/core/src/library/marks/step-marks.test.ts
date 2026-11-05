import { describe, expect, it } from "vitest";
import { parseStepContent } from "../steps/contract/step-contract";
import { canShowIcon, fitStepMarks } from "./step-marks";

const TABLE_TEXT = [
  "Each neighborhood's cases and residents:",
  "",
  "| Neighborhood | Cases | Residents |",
  "| --- | --- | --- |",
  "| A | 80 | 40,000 |",
  "| B | 40 | 10,000 |",
].join("\n");

function explanation(text: string) {
  return { content: parseStepContent("explanation", { text }), kind: "explanation" as const };
}

const icon = { smallUrl: "https://example.com/icon-96.webp", url: "https://example.com/icon.webp" };

describe(canShowIcon, () => {
  it("shows an icon on an explanation with no other visual", () => {
    expect(canShowIcon(explanation("A total counts cases, whoever lives there."))).toBe(true);
  });

  it("shows no icon beside a table in the explanation's text", () => {
    expect(canShowIcon(explanation(TABLE_TEXT))).toBe(false);
  });
});

describe(fitStepMarks, () => {
  it("drops an icon stored for a screen whose text shows a table, keeping its other marks", () => {
    const marks = { example: null, icon, ideaIndex: 0, underline: "cases and residents" };

    expect(fitStepMarks({ marks, screen: explanation(TABLE_TEXT) })).toStrictEqual({
      ...marks,
      icon: null,
    });
  });
});
