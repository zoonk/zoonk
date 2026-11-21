import { describe, expect, it } from "vitest";
import { acknowledgeSave, openDraft, parseKeptDraft } from "./writing-draft-choice";

const ADMISSION = "0191e1d6-6d2a-7b1c-9a50-5d1c1e9d6a01";
const REWRITE = "0191e1d6-6d2a-7b1c-9a50-5d1c1e9d6a02";

const saved = { admissionId: ADMISSION, revision: 3, text: "Saved on the other device." };

describe(openDraft, () => {
  it("keeps this device's edit typed over the draft the server still has", () => {
    const kept = { admissionId: ADMISSION, base: 3, text: "Typed here, not sent yet." };

    expect(openDraft({ admissionId: ADMISSION, kept, saved })).toMatchObject({
      conflict: null,
      position: { revision: 3, text: saved.text },
      text: kept.text,
    });
  });

  it("asks instead of choosing by revision when another device saved after this edit", () => {
    const kept = { admissionId: ADMISSION, base: 1, text: "Typed here over revision 1." };

    expect(openDraft({ admissionId: ADMISSION, kept, saved })).toMatchObject({
      conflict: { revision: 3, text: saved.text },
      position: { revision: 1 },
      text: kept.text,
    });
  });

  it("never offers a copy typed under another admission", () => {
    const kept = { admissionId: REWRITE, base: 9, text: "Typed under another admission." };
    expect(openDraft({ admissionId: ADMISSION, kept, saved })).toMatchObject({
      conflict: null,
      text: saved.text,
    });
  });

  it("never offers the first answer's copy for a rewrite that has nothing saved yet", () => {
    const kept = { admissionId: ADMISSION, base: 3, text: "The first answer, typed offline." };

    expect(openDraft({ admissionId: REWRITE, kept, saved: null })).toStrictEqual({
      conflict: null,
      position: { admissionId: REWRITE, revision: 0, text: "" },
      text: "",
    });
  });

  it("keeps a cleared field as cleared, so deleted text doesn't come back", () => {
    expect(
      openDraft({
        admissionId: ADMISSION,
        kept: { admissionId: ADMISSION, base: 3, text: "" },
        saved,
      }).text,
    ).toBe("");
  });

  it("starts from the saved draft, or empty, when this device kept nothing", () => {
    expect(openDraft({ admissionId: ADMISSION, kept: null, saved }).text).toBe(saved.text);
    expect(openDraft({ admissionId: ADMISSION, kept: null, saved: null }).text).toBe("");
  });

  it("saves a copy typed offline before any save under the admission it was typed under", () => {
    const kept = { admissionId: ADMISSION, base: 0, text: "Typed offline." };

    expect(openDraft({ admissionId: ADMISSION, kept, saved: null })).toStrictEqual({
      conflict: null,
      position: { admissionId: ADMISSION, revision: 0, text: "" },
      text: kept.text,
    });
  });
});

describe(acknowledgeSave, () => {
  it("keeps what was typed while the save was out, over the new revision", () => {
    expect(
      acknowledgeSave({
        admissionId: ADMISSION,
        latest: "first plus new paragraph",
        revision: 4,
        sent: "first",
      }),
    ).toStrictEqual({
      kept: { admissionId: ADMISSION, base: 4, text: "first plus new paragraph" },
      position: { admissionId: ADMISSION, revision: 4, text: "first" },
    });
  });

  it("keeps nothing on the device once all of it is on the server", () => {
    expect(
      acknowledgeSave({ admissionId: ADMISSION, latest: "first", revision: 4, sent: "first" }).kept,
    ).toBeNull();
  });
});

describe(parseKeptDraft, () => {
  it("reads what it wrote and ignores anything else", () => {
    expect(
      parseKeptDraft(JSON.stringify({ admissionId: ADMISSION, base: 2, text: "Hi" })),
    ).toStrictEqual({ admissionId: ADMISSION, base: 2, text: "Hi" });

    expect(parseKeptDraft(JSON.stringify({ base: 2, text: "Hi" }))).toStrictEqual({
      admissionId: null,
      base: 2,
      text: "Hi",
    });

    expect(parseKeptDraft("plain text from an older version")).toBeNull();
    expect(parseKeptDraft(null)).toBeNull();
  });
});
