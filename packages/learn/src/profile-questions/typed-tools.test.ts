import { describe, expect, it } from "vitest";
import { type ProfileDraft } from "./profile-draft";
import { addTypedTools, canAddTypedTools, typeInToolsField } from "./typed-tools";

function draft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return { exclusive: null, picks: [], studies: [], text: "", typed: [], ...overrides };
}

const TOOLS = [
  { description: null, id: "excel", label: "Excel" },
  { description: null, id: "Tasy", label: "Tasy" },
];

describe(addTypedTools, () => {
  it("each typed name becomes a chip and the field empties", () => {
    expect(
      addTypedTools({ draft: draft({ text: "ClinicalKey; Whitebook," }), options: TOOLS }),
    ).toStrictEqual(draft({ typed: ["ClinicalKey", "Whitebook"] }));
  });

  it("an offered name picks its chip, and a name already typed is left out", () => {
    expect(
      addTypedTools({
        draft: draft({ picks: ["Tasy"], text: "excel, tasy, whitebook", typed: ["Whitebook"] }),
        options: TOOLS,
      }),
    ).toStrictEqual(draft({ picks: ["Tasy", "excel"], typed: ["Whitebook"] }));
  });

  it("a name that would pass the saved limit stays whole in the field, and the rest are added", () => {
    const typed = ["a".repeat(113)];

    expect(
      addTypedTools({ draft: draft({ text: "Python, R", typed }), options: TOOLS }),
    ).toStrictEqual(draft({ text: "Python", typed: [...typed, "R"] }));
  });

  it("counts names joined as the server saves them, not as pasted", () => {
    const first = "a".repeat(60);
    const second = "b".repeat(59);

    expect(
      addTypedTools({ draft: draft({ text: `${first},${second}` }), options: TOOLS }),
    ).toStrictEqual(draft({ text: second, typed: [first] }));
  });

  it("counts an emoji as one character, as the server does", () => {
    const typed = ["a".repeat(114)];

    expect(addTypedTools({ draft: draft({ text: "📐CAD", typed }), options: TOOLS })).toStrictEqual(
      draft({ typed: [...typed, "📐CAD"] }),
    );
  });
});

function canAdd(text: string, typed: string[] = []) {
  return canAddTypedTools({ draft: draft({ text, typed }), options: TOOLS });
}

describe(canAddTypedTools, () => {
  it("Add is off for an empty field and for names that can't fit", () => {
    expect(canAdd(" ")).toBe(false);
    expect(canAdd("Python", ["a".repeat(118)])).toBe(false);
    expect(canAdd("R", ["Python"])).toBe(true);
    expect(canAdd("excel")).toBe(true);
  });
});

describe(typeInToolsField, () => {
  const typed = ["a".repeat(114)];

  it("takes a name up to the room left, counting an emoji as one character", () => {
    expect(
      typeInToolsField({ draft: draft({ text: "📐CA", typed }), options: TOOLS, text: "📐CAD" }),
    ).toStrictEqual(draft({ text: "📐CAD", typed }));

    const full = draft({ text: "📐CAD", typed });

    expect(typeInToolsField({ draft: full, options: TOOLS, text: "📐CADx" })).toBe(full);

    expect(typeInToolsField({ draft: full, options: TOOLS, text: "📐CA" })).toStrictEqual(
      draft({ text: "📐CA", typed }),
    );
  });

  it("a pasted list adds the names that fit and keeps the rest in the field", () => {
    const first = "a".repeat(60);
    const second = "b".repeat(59);

    expect(
      typeInToolsField({ draft: draft(), options: TOOLS, text: `${first},${second}` }),
    ).toStrictEqual(draft({ text: second, typed: [first] }));
  });

  it("text left in the field takes no more and doesn't add itself again as it's edited", () => {
    const left = draft({ text: "Python, R", typed: ["a".repeat(118)] });

    expect(typeInToolsField({ draft: left, options: TOOLS, text: "Python, Rx" })).toBe(left);

    expect(typeInToolsField({ draft: left, options: TOOLS, text: "Python, " })).toStrictEqual(
      draft({ text: "Python, ", typed: left.typed }),
    );
  });
});
