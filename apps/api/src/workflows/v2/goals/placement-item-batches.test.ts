import { describe, expect, it } from "vitest";
import { toPlacementItemBatches } from "./placement-item-batches";

function skillsOf(count: number, attrs: { needsTyped?: boolean; ownerId?: string | null } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${attrs.ownerId ?? "shared"}-${String(attrs.needsTyped ?? true)}-${index}`,
    needsTyped: attrs.needsTyped ?? true,
    ownerId: attrs.ownerId ?? null,
  }));
}

function idsOf(batches: { id: string }[][]) {
  return batches.map((batch) => batch.map((skill) => skill.id));
}

describe(toPlacementItemBatches, () => {
  it("writes the first pick alone, then two skills per call, in pick order, in calls of even size", () => {
    const skills = skillsOf(5);

    expect(idsOf(toPlacementItemBatches({ quickCount: 1, skills }))).toStrictEqual([
      skills.slice(0, 1).map((skill) => skill.id),
      skills.slice(1, 3).map((skill) => skill.id),
      skills.slice(3).map((skill) => skill.id),
    ]);

    expect(
      toPlacementItemBatches({ quickCount: 1, skills: skillsOf(16) }).map((batch) => batch.length),
    ).toStrictEqual([1, 1, 2, 2, 2, 2, 2, 2, 2]);

    expect(
      toPlacementItemBatches({ quickCount: 1, skills: skillsOf(2) }).map((batch) => batch.length),
    ).toStrictEqual([1, 1]);
  });

  it("gives a skill a call of its own when it needs several quick questions, as a test-out's do", () => {
    const skills = skillsOf(3, { needsTyped: false });

    expect(idsOf(toPlacementItemBatches({ quickCount: 3, skills }))).toStrictEqual(
      skills.map((skill) => [skill.id]),
    );
  });

  it("never mixes skills that need different questions or whose content has another owner", () => {
    const needsBoth = skillsOf(2);
    const quickOnly = skillsOf(2, { needsTyped: false });
    const personal = skillsOf(1, { ownerId: "learner" });

    expect(
      idsOf(
        toPlacementItemBatches({
          quickCount: 1,
          skills: [needsBoth[0]!, quickOnly[0]!, personal[0]!, needsBoth[1]!, quickOnly[1]!],
        }),
      ),
    ).toStrictEqual([
      [needsBoth[0]!.id],
      quickOnly.map((skill) => skill.id),
      personal.map((skill) => skill.id),
      [needsBoth[1]!.id],
    ]);
  });

  it("makes no call when every picked skill already has its questions", () => {
    expect(toPlacementItemBatches({ quickCount: 1, skills: [] })).toStrictEqual([]);
  });
});
