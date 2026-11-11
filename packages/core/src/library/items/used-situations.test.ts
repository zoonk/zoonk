import { randomUUID } from "node:crypto";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadUsedSituations } from "./used-situations";

function caseItem({ context, ...attrs }: Parameters<typeof itemFixture>[0] & { context: string }) {
  return itemFixture({ ...attrs, content: { ...choiceItemContent(), context } });
}

describe(loadUsedSituations, () => {
  it("lists the cases of every question its learner can be served, and none of another exam's or field's", async () => {
    const [skill, exam, otherExam] = await Promise.all([
      skillFixture(),
      examBlueprintFixture({ identityKey: `exam-${randomUUID()}` }),
      examBlueprintFixture({ identityKey: `exam-${randomUUID()}` }),
    ]);

    await Promise.all([
      caseItem({ context: "General case.", skillId: skill.id }),
      caseItem({ context: "This exam's case.", examBlueprintId: exam.id, skillId: skill.id }),
      caseItem({ context: "Other exam's case.", examBlueprintId: otherExam.id, skillId: skill.id }),
      caseItem({ context: "Nursing case.", field: "nursing", skillId: skill.id }),
      caseItem({ context: "Law case.", field: "law", skillId: skill.id }),
      caseItem({ context: "Retired case.", retiredAt: new Date(), skillId: skill.id }),
    ]);

    const [forExam, forField] = await Promise.all([
      loadUsedSituations({ examBlueprintId: exam.id, skillIds: [skill.id] }),
      loadUsedSituations({ field: "nursing", skillIds: [skill.id] }),
    ]);

    expect(forExam.get(skill.id)?.toSorted()).toStrictEqual(["General case.", "This exam's case."]);
    expect(forField.get(skill.id)?.toSorted()).toStrictEqual(["General case.", "Nursing case."]);
  });

  it("puts the cases its learner already answered first, and gives a skill without questions none", async () => {
    const [user, skill, empty] = await Promise.all([userFixture(), skillFixture(), skillFixture()]);

    const answered = await caseItem({
      context: "Answered case.",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      skillId: skill.id,
    });

    await Promise.all([
      attemptFixture({ itemId: answered.id, skillId: skill.id, userId: user.id }),
      caseItem({
        context: "Newer case.",
        createdAt: new Date("2026-10-02T00:00:00Z"),
        skillId: skill.id,
      }),
    ]);

    const situations = await loadUsedSituations({
      skillIds: [skill.id, empty.id],
      userId: user.id,
    });

    expect(situations.get(skill.id)).toStrictEqual(["Answered case.", "Newer case."]);
    expect(situations.get(empty.id)).toStrictEqual([]);
  });
});
