import { describe, expect, it } from "vitest";
import { chooseDraftText, parseKeptDraft } from "./writing-draft-choice";

const saved = { revision: 3, text: "Saved on the other device." };

describe(chooseDraftText, () => {
  it("keeps this device's edit typed over the draft the server still has", () => {
    expect(chooseDraftText({ kept: { base: 3, text: "Typed here, not sent yet." }, saved })).toBe(
      "Typed here, not sent yet.",
    );
  });

  it("continues a newer draft saved on another device over an older copy here", () => {
    expect(chooseDraftText({ kept: { base: 1, text: "An older copy." }, saved })).toBe(saved.text);
  });

  it("starts from the saved draft, or empty, when this device kept nothing", () => {
    expect(chooseDraftText({ kept: null, saved })).toBe(saved.text);
    expect(chooseDraftText({ kept: { base: 0, text: "  " }, saved: null })).toBe("");
  });
});

describe(parseKeptDraft, () => {
  it("reads what it wrote and ignores anything else", () => {
    expect(parseKeptDraft(JSON.stringify({ base: 2, text: "Hi" }))).toStrictEqual({
      base: 2,
      text: "Hi",
    });

    expect(parseKeptDraft("plain text from an older version")).toBeNull();
    expect(parseKeptDraft(null)).toBeNull();
  });
});
