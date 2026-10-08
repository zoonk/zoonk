import { describe, expect, it } from "vitest";
import {
  type CapsuleItemCandidate,
  capReviewDay,
  getCapsuleOpening,
  groupIntoCapsules,
  pickCapsuleFormat,
  pickCapsuleItems,
} from "./capsules";

function item(
  id: string,
  skillId: string,
  format: CapsuleItemCandidate["format"] = "multipleChoice",
  lastAnsweredAt: string | null = null,
): CapsuleItemCandidate {
  return { format, id, lastAnsweredAt: lastAnsweredAt ? new Date(lastAnsweredAt) : null, skillId };
}

describe(groupIntoCapsules, () => {
  it("groups due skills by the lesson that taught them, most urgent capsule first", () => {
    expect(
      groupIntoCapsules([
        { lessonId: "discounts", skillId: "a", title: "Discounts" },
        { lessonId: null, skillId: "b", title: "Ratios" },
        { lessonId: "discounts", skillId: "c", title: "Discounts" },
      ]),
    ).toStrictEqual([
      { key: "discounts", lessonId: "discounts", skillIds: ["a", "c"], title: "Discounts" },
      { key: "skill:b", lessonId: null, skillIds: ["b"], title: "Ratios" },
    ]);
  });
});

describe(pickCapsuleFormat, () => {
  it("swipes true or false for net-scored exams, matches pairs when it can, else rapid-fire", () => {
    expect(pickCapsuleFormat({ formats: ["trueFalse", "matchPairs"], netScoring: true })).toBe(
      "swipe",
    );

    expect(pickCapsuleFormat({ formats: ["multipleChoice"], netScoring: true })).toBe("rapidFire");
    expect(pickCapsuleFormat({ formats: ["matchPairs"], netScoring: false })).toBe("matchPairs");
    expect(pickCapsuleFormat({ formats: ["trueFalse"], netScoring: false })).toBe("rapidFire");
  });
});

describe(pickCapsuleItems, () => {
  it("takes one question per skill in turn, least recently answered first, up to three", () => {
    const candidates = [
      item("a-old", "a", "multipleChoice", "2026-09-01T10:00:00Z"),
      item("a-new", "a"),
      item("b-1", "b", "trueFalse"),
      item("a-essay", "a", "essay"),
      item("c-1", "c"),
      item("b-2", "b"),
    ];

    expect(
      pickCapsuleItems({ candidates, format: "rapidFire", skillIds: ["a", "b"] }),
    ).toStrictEqual(["a-new", "b-1", "a-old"]);
  });

  it("asks one matching question for match pairs and statements for swipe", () => {
    const candidates = [item("pairs", "a", "matchPairs"), item("tf", "a", "trueFalse")];

    expect(pickCapsuleItems({ candidates, format: "matchPairs", skillIds: ["a"] })).toStrictEqual([
      "pairs",
    ]);

    expect(pickCapsuleItems({ candidates, format: "swipe", skillIds: ["a"] })).toStrictEqual([
      "tf",
    ]);
  });
});

describe(getCapsuleOpening, () => {
  it("opens on the first day one of its ideas is due", () => {
    expect(
      getCapsuleOpening([
        { due: new Date("2026-10-09T03:00:00Z") },
        { due: null },
        { due: new Date("2026-10-07T03:00:00Z") },
      ]),
    ).toStrictEqual(new Date("2026-10-07T03:00:00Z"));

    expect(getCapsuleOpening([{ due: null }])).toBeNull();
  });
});

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe(capReviewDay, () => {
  const today = day("2026-10-05");

  it("keeps a review day before the goal's date, and any day without one", () => {
    expect(
      capReviewDay({ day: day("2026-10-09"), targetDate: day("2026-11-08"), today }),
    ).toStrictEqual(day("2026-10-09"));

    expect(capReviewDay({ day: day("2026-11-30"), targetDate: null, today })).toStrictEqual(
      day("2026-11-30"),
    );
  });

  it("never says an idea comes back after the exam: the last day before it instead", () => {
    expect(
      capReviewDay({ day: day("2026-11-30"), targetDate: day("2026-11-08"), today }),
    ).toStrictEqual(day("2026-11-07"));
  });

  it("brings an idea already due back tomorrow, never on a day that passed", () => {
    expect(capReviewDay({ day: day("2026-09-29"), targetDate: null, today })).toStrictEqual(
      day("2026-10-06"),
    );
  });

  it("says no day when the goal's date leaves none after today", () => {
    expect(
      capReviewDay({ day: day("2026-10-09"), targetDate: day("2026-10-06"), today }),
    ).toBeNull();
  });
});
