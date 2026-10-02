import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import {
  generatedMultipleChoice,
  generatedProvenance,
  generatedTypedItem,
} from "./_test-utils/generated-items";
import { createItems } from "./create-items";
import { parseItemContent } from "./item-content";

describe(createItems, () => {
  it("stores checked items with their exam, field, difficulty and provenance", async () => {
    const [skill, exam] = await Promise.all([skillFixture(), examBlueprintFixture()]);
    const provenance = generatedProvenance();
    const item = generatedMultipleChoice({ difficulty: "hard" });

    const { created, rejected } = await createItems({
      examBlueprintId: exam.id,
      field: "nursing",
      format: "multipleChoice",
      items: [item],
      language: "pt",
      provenance,
      skillId: skill.id,
    });

    expect(rejected).toStrictEqual([]);
    expect(created).toHaveLength(1);

    expect(created[0]).toMatchObject({
      difficulty: 1,
      examBlueprintId: exam.id,
      field: "nursing",
      format: "multipleChoice",
      generatedAt: new Date(provenance.generatedAt),
      language: "pt",
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
      skillId: skill.id,
    });

    const { difficulty: _difficulty, format: _format, ...expectedContent } = item;

    expect(
      parseItemContent({ content: created[0]!.content, format: "multipleChoice" }),
    ).toStrictEqual({ content: expectedContent, format: "multipleChoice" });
  });

  it("keeps items that fail the checks out and reports why", async () => {
    const skill = await skillFixture();
    const good = generatedMultipleChoice();

    const twoCorrect = generatedMultipleChoice({
      options: good.options.map((option) => ({ ...option, isCorrect: true })),
    });

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [twoCorrect, good, generatedTypedItem()],
      language: "en",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created.map((item) => parseItemContent(item).content)).toStrictEqual([
      expect.objectContaining({ question: good.question }),
    ]);

    expect(rejected).toStrictEqual([
      { index: 0, problems: ["Has 2 correct options instead of 1."] },
      { index: 2, problems: ["Is typed instead of multipleChoice."] },
    ]);
  });

  it("stores options without the letters the writer printed before them", async () => {
    const skill = await skillFixture();
    const item = generatedMultipleChoice();
    const [right, wrong] = item.options;

    // ENEM placement, Sep 2026: the writer followed "5 alternativas (A a E)" and labeled each one.
    const labeled = generatedMultipleChoice({
      options: [
        { ...wrong!, text: "B) 20" },
        { ...right!, text: "A) 5" },
      ],
    });

    const { created } = await createItems({
      format: "multipleChoice",
      items: [labeled],
      language: "pt",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    const stored = await prisma.item.findUniqueOrThrow({ where: { id: created[0]!.id } });

    expect(stored.content).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true, text: "5" }),
        expect.objectContaining({ isCorrect: false, text: "20" }),
      ]),
    });
  });

  it("enforces the exam's option count", async () => {
    const skill = await skillFixture();

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [generatedMultipleChoice()],
      language: "pt",
      optionCount: 5,
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created).toStrictEqual([]);
    expect(rejected).toStrictEqual([{ index: 0, problems: ["Has 2 options instead of 5."] }]);
  });

  it("returns the stored items instead of copies when a workflow step retries", async () => {
    const skill = await skillFixture();
    const provenance = generatedProvenance();
    const items = [generatedTypedItem(), generatedTypedItem({ question: "Another question?" })];

    const params = {
      format: "typed" as const,
      items,
      language: "en",
      provenance,
      skillId: skill.id,
    };

    const first = await createItems(params);
    const retry = await createItems(params);

    expect(retry.created.map((item) => item.id)).toStrictEqual(
      first.created.map((item) => item.id),
    );

    await expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(2);
  });

  it("stores each format one run wrote for a skill, and still no copies on a retry", async () => {
    const skill = await skillFixture();
    const provenance = generatedProvenance();
    const shared = { language: "en", provenance, skillId: skill.id };

    const choice = {
      ...shared,
      format: "multipleChoice" as const,
      items: [generatedMultipleChoice()],
    };

    const typed = { ...shared, format: "typed" as const, items: [generatedTypedItem()] };

    await createItems(choice);
    const stored = await createItems(typed);
    const retried = await createItems(typed);

    expect(stored.created).toHaveLength(1);

    expect(retried.created.map((item) => item.id)).toStrictEqual(
      stored.created.map((item) => item.id),
    );

    const formats = await prisma.item.findMany({
      select: { format: true },
      where: { skillId: skill.id },
    });

    expect(formats.map((item) => item.format).toSorted()).toStrictEqual([
      "multipleChoice",
      "typed",
    ]);
  });
});
