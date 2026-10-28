import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { generatedProvenance, writtenItemSet } from "./_test-utils/generated-items";
import { parseItemSetContent } from "./item-set-content";
import { storeWrittenItemSet } from "./store-item-set";

describe(storeWrittenItemSet, () => {
  it("stores the passage and its questions in order, each on the skill its number names", async () => {
    const [blueprint, reading, inference] = await Promise.all([
      examBlueprintFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const written = writtenItemSet();
    const [first, second, third] = written.questions;

    const stored = await storeWrittenItemSet({
      examBlueprintId: blueprint.id,
      format: "trueFalse",
      language: "en",
      provenance: generatedProvenance(),
      skillIds: [reading.id, inference.id],
      written: {
        ...written,
        questions: [first!, { ...second!, evidence: "Visits doubled." }, third!],
      },
    });

    expect(stored).toMatchObject({
      problems: [],
      rejected: [{ index: 1, problems: ["Its evidence isn't in the stimulus."] }],
    });

    const set = await prisma.itemSet.findUniqueOrThrow({
      include: { items: { orderBy: { setPosition: "asc" } } },
      where: { id: stored.setId ?? "" },
    });

    expect(parseItemSetContent(set)).toStrictEqual({
      content: { source: null, text: written.text, title: "Sundays at the library" },
      kind: "text",
    });

    expect(
      set.items.map((item) => [item.setPosition, item.skillId, item.format, item.examBlueprintId]),
    ).toStrictEqual([
      [0, reading.id, "trueFalse", blueprint.id],
      [1, reading.id, "trueFalse", blueprint.id],
    ]);
  });

  it("stores nothing when its stimulus fails, or fewer than two questions pass", async () => {
    const skill = await skillFixture();
    const written = writtenItemSet();
    const provenance = generatedProvenance();

    const shared = {
      examBlueprintId: null,
      format: "trueFalse" as const,
      language: "en",
      provenance,
    };

    const short = await storeWrittenItemSet({
      ...shared,
      skillIds: [skill.id, skill.id],
      written: { ...written, text: "Visits had risen by a third." },
    });

    const lonely = await storeWrittenItemSet({
      ...shared,
      skillIds: [skill.id, skill.id],
      written: { ...written, questions: written.questions.slice(0, 1) },
    });

    expect(short).toMatchObject({ setId: null });
    expect(short.problems).toContain("The text has 6 words, fewer than 90.");
    expect(lonely).toMatchObject({ setId: null });
    await expect(prisma.itemSet.count({ where: { runId: provenance.runId } })).resolves.toBe(0);
  });
});
