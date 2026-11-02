import { type Item, prisma } from "@zoonk/db";
import { listeningContent } from "@zoonk/testing/fixtures/listening";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { generatedMultipleChoice, generatedProvenance } from "./_test-utils/generated-items";
import { createItemSet } from "./create-item-set";
import { parseItemContent } from "./item-content";

function readQuestion(item: Item): string | null {
  const { content } = parseItemContent(item);
  return "question" in content ? content.question : null;
}

async function setInputs() {
  const [blueprint, detail, gist] = await Promise.all([
    examBlueprintFixture(),
    skillFixture(),
    skillFixture(),
  ]);

  const items = [
    { format: "multipleChoice" as const, item: generatedMultipleChoice(), skillId: detail.id },
    { format: "multipleChoice" as const, item: generatedMultipleChoice(), skillId: gist.id },
    { format: "multipleChoice" as const, item: generatedMultipleChoice(), skillId: detail.id },
  ];

  return { blueprint, items };
}

describe(createItemSet, () => {
  it("stores the stimulus with its checked questions in the order given, each on its own skill", async () => {
    const { blueprint, items } = await setInputs();
    const content = listeningContent();
    const provenance = generatedProvenance();

    const { rejected, set } = await createItemSet({
      content,
      examBlueprintId: blueprint.id,
      items,
      kind: "audio",
      language: "pt",
      provenance,
    });

    expect(rejected).toStrictEqual([]);

    expect(set).toMatchObject({
      content,
      examBlueprintId: blueprint.id,
      kind: "audio",
      language: "pt",
      mediaAssetId: null,
      runId: provenance.runId,
    });

    const stored = await prisma.item.findMany({
      orderBy: { setPosition: "asc" },
      where: { setId: set?.id },
    });

    expect(
      stored.map((item) => ({
        examBlueprintId: item.examBlueprintId,
        language: item.language,
        position: item.setPosition,
        question: readQuestion(item),
        skillId: item.skillId,
      })),
    ).toStrictEqual(
      items.map((entry, position) => ({
        examBlueprintId: blueprint.id,
        language: "pt",
        position,
        question: entry.item.question,
        skillId: entry.skillId,
      })),
    );
  });

  it("leaves out a question its checks reject and keeps the others in order", async () => {
    const { blueprint, items } = await setInputs();
    const [first, , third] = items;

    const flawed = {
      ...items[1],
      format: "multipleChoice" as const,
      item: generatedMultipleChoice({
        options: [
          { isCorrect: false, misconception: "Guesses", reason: "No.", text: "3" },
          { isCorrect: false, misconception: "Doubles", reason: "No.", text: "20" },
        ],
      }),
      skillId: items[1]?.skillId ?? "",
    };

    const { rejected, set } = await createItemSet({
      content: listeningContent(),
      examBlueprintId: blueprint.id,
      items: [first, flawed, third].flatMap((entry) => (entry ? [entry] : [])),
      kind: "audio",
      language: "pt",
      provenance: generatedProvenance(),
    });

    expect(rejected.map(({ index }) => index)).toStrictEqual([1]);

    const stored = await prisma.item.findMany({
      orderBy: { setPosition: "asc" },
      where: { setId: set?.id },
    });

    expect(stored.map((item) => [item.setPosition, readQuestion(item)])).toStrictEqual([
      [0, first?.item.question],
      [1, third?.item.question],
    ]);
  });

  it("returns the set a retried step already stored instead of storing a copy", async () => {
    const { blueprint, items } = await setInputs();
    const provenance = generatedProvenance();

    const input = {
      content: listeningContent(),
      examBlueprintId: blueprint.id,
      items,
      kind: "audio" as const,
      language: "pt",
      provenance,
    };

    const first = await createItemSet(input);
    const retried = await createItemSet(input);

    expect(retried.set?.id).toBe(first.set?.id);
    await expect(prisma.itemSet.count({ where: { runId: provenance.runId } })).resolves.toBe(1);
    await expect(prisma.item.count({ where: { setId: first.set?.id } })).resolves.toBe(3);
  });

  it("stores a second set a run writes as a set of its own", async () => {
    const { blueprint, items } = await setInputs();
    const provenance = generatedProvenance();
    const shared = { examBlueprintId: blueprint.id, items, kind: "audio" as const, language: "pt" };

    const first = await createItemSet({ ...shared, content: listeningContent(), provenance });
    const second = await createItemSet({ ...shared, content: listeningContent(), provenance });

    expect(second.set?.id).not.toBe(first.set?.id);
    await expect(prisma.itemSet.count({ where: { runId: provenance.runId } })).resolves.toBe(2);
  });

  it("refuses a stimulus that isn't its kind's shape", async () => {
    const { blueprint, items } = await setInputs();

    await expect(
      createItemSet({
        content: { text: "A passage." },
        examBlueprintId: blueprint.id,
        items,
        kind: "text",
        language: "pt",
        provenance: generatedProvenance(),
      }),
    ).rejects.toThrow();
  });

  it("stores no set when none of its questions passes", async () => {
    const { blueprint } = await setInputs();
    const skill = await skillFixture();
    const provenance = generatedProvenance();

    const { rejected, set } = await createItemSet({
      content: listeningContent(),
      examBlueprintId: blueprint.id,
      items: [
        {
          format: "multipleChoice",
          item: generatedMultipleChoice({ options: [] }),
          skillId: skill.id,
        },
      ],
      kind: "audio",
      language: "pt",
      provenance,
    });

    expect(set).toBeNull();
    expect(rejected).toHaveLength(1);
    await expect(prisma.itemSet.count({ where: { runId: provenance.runId } })).resolves.toBe(0);
  });
});
