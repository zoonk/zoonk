import { describe, expect, it } from "vitest";
import { toPlacementItemBatches } from "./placement-item-batches";

function skillsOf(
  count: number,
  attrs: { country?: string; ownerId?: string | null; tapsNeeded?: number } = {},
) {
  return Array.from({ length: count }, (_, index) => ({
    country: attrs.country ?? null,
    id: `${attrs.ownerId ?? "shared"}-${String(attrs.tapsNeeded ?? 0)}-${index}`,
    needsQuick: true,
    ownerId: attrs.ownerId ?? null,
    tapsNeeded: attrs.tapsNeeded ?? 0,
  }));
}

function idsOf(batches: { id: string }[][]) {
  return batches.map((batch) => batch.map((skill) => skill.id));
}

describe(toPlacementItemBatches, () => {
  it("writes the first pick alone, then two quick-only skills per call, in pick order, in calls of even size", () => {
    const skills = skillsOf(5);

    expect(idsOf(toPlacementItemBatches({ quickCount: 1, skills }))).toStrictEqual([
      skills.slice(0, 1).map((skill) => skill.id),
      skills.slice(1, 3).map((skill) => skill.id),
      skills.slice(3).map((skill) => skill.id),
    ]);

    expect(
      toPlacementItemBatches({ quickCount: 1, skills: skillsOf(16) }).map((batch) => batch.length),
    ).toStrictEqual([1, 1, 2, 2, 2, 2, 2, 2, 2]);
  });

  it("writes the first pick's quick and tap questions in two calls, and each skill with taps alone", () => {
    const [first, second] = skillsOf(2, { tapsNeeded: 3 });

    expect(toPlacementItemBatches({ quickCount: 1, skills: [first!, second!] })).toStrictEqual([
      [{ ...first, quickCount: 1, tapCount: 0 }],
      [{ ...first, quickCount: 0, tapCount: 3 }],
      [{ ...second, quickCount: 1, tapCount: 3 }],
    ]);
  });

  it("writes no quick question for a skill that has enough", () => {
    const [skill] = skillsOf(1, { tapsNeeded: 2 });

    expect(
      toPlacementItemBatches({ quickCount: 2, skills: [{ ...skill!, needsQuick: false }] }),
    ).toStrictEqual([[{ ...skill, needsQuick: false, quickCount: 0, tapCount: 2 }]]);
  });

  it("gives a skill a call of its own when it needs several quick questions, as a test-out's do", () => {
    const skills = skillsOf(3);

    expect(idsOf(toPlacementItemBatches({ quickCount: 3, skills }))).toStrictEqual(
      skills.map((skill) => [skill.id]),
    );
  });

  it("never mixes skills whose content has another owner", () => {
    const shared = skillsOf(3);
    const personal = skillsOf(1, { ownerId: "learner" });

    expect(
      idsOf(toPlacementItemBatches({ quickCount: 1, skills: [...shared, ...personal] })),
    ).toStrictEqual([[shared[0]!.id], [shared[1]!.id, shared[2]!.id], [personal[0]!.id]]);
  });

  it("makes no call when every picked skill already has its questions", () => {
    expect(toPlacementItemBatches({ quickCount: 1, skills: [] })).toStrictEqual([]);
  });

  it("never writes two countries' skills in the same batch", () => {
    const skills = [...skillsOf(2, { country: "PT" }), ...skillsOf(2, { country: "BR" })];
    const batches = toPlacementItemBatches({ quickCount: 1, skills });

    expect(batches.every((batch) => new Set(batch.map((skill) => skill.country)).size === 1)).toBe(
      true,
    );
  });
});
