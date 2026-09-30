import { describe, expect, it } from "vitest";
import { insertAtCursor } from "./insert-at-cursor";

describe(insertAtCursor, () => {
  it("inserts at the cursor and moves the cursor after the text", () => {
    expect(
      insertAtCursor({
        selectionEnd: 3,
        selectionStart: 3,
        snippet: { before: "\\d" },
        value: "^ab$",
      }),
    ).toStrictEqual({ cursor: 5, value: "^ab\\d$" });
  });

  it("puts the cursor between a pair so the learner types inside it", () => {
    expect(
      insertAtCursor({
        selectionEnd: 4,
        selectionStart: 4,
        snippet: { after: "}", before: "{" },
        value: "\\d{5",
      }),
    ).toStrictEqual({ cursor: 5, value: "\\d{5{}" });
  });

  it("wraps a selection", () => {
    expect(
      insertAtCursor({
        selectionEnd: 7,
        selectionStart: 1,
        snippet: { after: ")", before: "(" },
        value: "^-\\d{4}$",
      }),
    ).toStrictEqual({ cursor: 8, value: "^(-\\d{4})$" });
  });

  it("keeps a stale selection inside the text", () => {
    expect(
      insertAtCursor({
        selectionEnd: 40,
        selectionStart: 40,
        snippet: { before: "$" },
        value: "^a",
      }),
    ).toStrictEqual({ cursor: 3, value: "^a$" });
  });
});
