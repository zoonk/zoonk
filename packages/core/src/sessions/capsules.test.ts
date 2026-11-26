import { describe, expect, it } from "vitest";
import {
  type CapsuleItemCandidate,
  capReviewDay,
  getCapsuleOpening,
  groupIntoCapsules,
  isLightMatch,
  pickCapsuleItems,
} from "./capsules";

function item(
  id: string,
  skillId: string,
  format: CapsuleItemCandidate["format"] = "multipleChoice",
  lastAnsweredAt: string | null = null,
): CapsuleItemCandidate {
  return {
    content:
      format === "matchPairs"
        ? {
            pairs: [
              { left: "a", right: "b" },
              { left: "c", right: "d" },
            ],
          }
        : null,
    format,
    id,
    lastAnsweredAt: lastAnsweredAt ? new Date(lastAnsweredAt) : null,
    skillId,
  };
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

describe(isLightMatch, () => {
  const pair = { left: "Lunar eclipse", right: "Earth's shadow" };

  it("accepts five short pairs and sets aside larger boards or sentence-length cards", () => {
    expect(isLightMatch({ pairs: Array.from({ length: 5 }, () => pair) })).toBe(true);

    expect(
      isLightMatch({ pairs: [pair, { ...pair, right: "Earth's largest natural moon" }] }),
    ).toBe(true);

    expect(isLightMatch({ pairs: Array.from({ length: 6 }, () => pair) })).toBe(false);

    expect(
      isLightMatch({ pairs: [pair, { ...pair, right: "The Moon moves through Earth's shadow" }] }),
    ).toBe(false);
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

    expect(pickCapsuleItems({ candidates, netScoring: false, skillIds: ["a", "b"] })).toStrictEqual(
      { format: "rapidFire", itemIds: ["a-new", "b-1", "a-old"] },
    );
  });

  it("selects across due skills and asks just one question for a matching capsule", () => {
    const pairs = item("pairs", "b", "matchPairs", "2026-09-01T10:00:00Z");
    const choice = item("choice", "a");

    expect(
      pickCapsuleItems({ candidates: [pairs, choice], netScoring: false, skillIds: ["a", "b"] }),
    ).toStrictEqual({ format: "rapidFire", itemIds: ["choice"] });

    expect(
      pickCapsuleItems({
        candidates: [{ ...pairs, inField: true }, choice],
        netScoring: false,
        skillIds: ["a", "b"],
      }),
    ).toStrictEqual({ format: "matchPairs", itemIds: ["pairs"] });
  });

  it("selects statements for net-scored exams and defaults to rapid-fire for recordings", () => {
    const candidates = [
      item("pairs", "a", "matchPairs"),
      item("tf", "a", "trueFalse", "2026-09-01T10:00:00Z"),
    ];

    expect(pickCapsuleItems({ candidates, netScoring: true, skillIds: ["a"] })).toStrictEqual({
      format: "swipe",
      itemIds: ["tf"],
    });

    expect(pickCapsuleItems({ candidates: [], netScoring: false, skillIds: ["a"] })).toStrictEqual({
      format: "rapidFire",
      itemIds: [],
    });
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

  it("says no day when the idea's review falls on or after the exam, which it outlasts", () => {
    expect(
      capReviewDay({ day: day("2026-11-30"), targetDate: day("2026-11-08"), today }),
    ).toBeNull();

    expect(
      capReviewDay({ day: day("2026-11-08"), targetDate: day("2026-11-08"), today }),
    ).toBeNull();
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
