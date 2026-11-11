import { randomUUID } from "node:crypto";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
  textSetContent,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
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

  it("takes a set question's case from its shared stimulus, once per set", async () => {
    const [skill, exam] = await Promise.all([
      skillFixture(),
      examBlueprintFixture({ identityKey: `exam-${randomUUID()}` }),
    ]);

    const set = await itemSetFixture({
      content: { ...textSetContent(), text: "The town's library opened on Sundays." },
      examBlueprintId: exam.id,
    });

    await Promise.all(
      ["Why did visits rise?", "Who came most?"].map((question) =>
        itemFixture({
          content: choiceItemContent(question),
          examBlueprintId: exam.id,
          setId: set.id,
          skillId: skill.id,
        }),
      ),
    );

    const situations = await loadUsedSituations({ examBlueprintId: exam.id, skillIds: [skill.id] });

    expect(situations.get(skill.id)).toStrictEqual(["The town's library opened on Sundays."]);
  });

  it("takes a chart set's case from its chart's title when the set has no text or title", async () => {
    const skill = await skillFixture();

    const set = await itemSetFixture({
      content: {
        source: null,
        text: null,
        title: null,
        visual: { kind: "chart", title: "Library visits by month" },
      },
      kind: "chart",
    });

    await itemFixture({ content: choiceItemContent(), setId: set.id, skillId: skill.id });

    const situations = await loadUsedSituations({ skillIds: [skill.id] });

    expect(situations.get(skill.id)).toStrictEqual(["Library visits by month"]);
  });

  it("lists every case a skill's bank holds, and none for a skill without questions", async () => {
    const [skill, empty] = await Promise.all([skillFixture(), skillFixture()]);
    const cases = Array.from({ length: 12 }, (_, index) => `Case ${index}.`);

    await Promise.all(cases.map((context) => caseItem({ context, skillId: skill.id })));

    const situations = await loadUsedSituations({ skillIds: [skill.id, empty.id] });

    expect(situations.get(skill.id)?.toSorted()).toStrictEqual(cases.toSorted());
    expect(situations.get(empty.id)).toStrictEqual([]);
  });
});
