import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { examStructureSchema } from "./blueprint-contract";
import { getExamChoiceFormat } from "./exam-choice-format";
import { findChoiceOptionsLookup, recordChoiceOptions } from "./record-choice-options";
import { findSubjectQuestionsLookup, recordSubjectQuestions } from "./record-subject-questions";

const citation = { passage: "180 questões objetivas", sourceId: "notice" };

function structure(options: number | null) {
  return {
    formats: [{ citation, description: "Questões objetivas", kind: "multipleChoice", options }],
    mock: null,
    rules: [],
    subjects: ["Linguagens", "Humanas", "Natureza"].map((name) => ({
      citation,
      name,
      questions: null,
      topics: [],
      weight: null,
    })),
  };
}

async function readStructure(id: string) {
  const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id } });
  return examStructureSchema.parse(stored.structure);
}

const DAY_MS = 86_400_000;

describe(recordChoiceOptions, () => {
  it("looks up the options of a notice that doesn't state them once, and the format then has them", async () => {
    const blueprint = await examBlueprintFixture({
      board: "Inep",
      name: "Enem",
      structure: structure(null),
    });

    await expect(findChoiceOptionsLookup({ examBlueprintId: blueprint.id })).resolves.toStrictEqual(
      { board: "Inep", exam: "Enem" },
    );

    await recordChoiceOptions({
      edition: "Enem 2025",
      examBlueprintId: blueprint.id,
      options: 5,
      source: { title: "Provas e gabaritos", url: "https://www.gov.br/inep/provas" },
    });

    const stored = await readStructure(blueprint.id);

    expect(stored.pastOptions).toMatchObject({ edition: "Enem 2025", options: 5 });
    expect(getExamChoiceFormat(stored)).toMatchObject({ kind: "multipleChoice", options: 5 });
    await expect(findChoiceOptionsLookup({ examBlueprintId: blueprint.id })).resolves.toBeNull();
  });

  it("never looks up a notice that states them, or a private blueprint", async () => {
    const owner = await userFixture();

    const [stated, own] = await Promise.all([
      examBlueprintFixture({ structure: structure(4) }),
      examBlueprintFixture({
        ownerId: owner.id,
        structure: structure(null),
        visibility: "private",
      }),
    ]);

    await expect(findChoiceOptionsLookup({ examBlueprintId: stated.id })).resolves.toBeNull();
    await expect(findChoiceOptionsLookup({ examBlueprintId: own.id })).resolves.toBeNull();
  });

  it("tries a lookup that found nothing again a month later", async () => {
    const blueprint = await examBlueprintFixture({ structure: structure(null) });
    const checkedAt = new Date("2026-10-01T12:00:00.000Z");

    await recordChoiceOptions({
      edition: "ignored",
      examBlueprintId: blueprint.id,
      now: checkedAt,
      options: null,
      source: { title: null, url: "https://example.com/ignored" },
    });

    await expect(readStructure(blueprint.id)).resolves.toMatchObject({
      pastOptions: { edition: null, options: null, source: null },
    });

    const lookUp = (days: number) =>
      findChoiceOptionsLookup({
        examBlueprintId: blueprint.id,
        now: new Date(checkedAt.getTime() + days * DAY_MS),
      });

    await expect(lookUp(10)).resolves.toBeNull();
    await expect(lookUp(31)).resolves.not.toBeNull();
  });

  it("keeps the subjects' counts recorded at the same time", async () => {
    const blueprint = await examBlueprintFixture({ structure: structure(null) });
    const lookup = await findSubjectQuestionsLookup({ examBlueprintId: blueprint.id });

    await Promise.all([
      recordChoiceOptions({
        edition: "Enem 2025",
        examBlueprintId: blueprint.id,
        options: 5,
        source: { title: null, url: "https://www.gov.br/inep/provas" },
      }),
      recordSubjectQuestions({
        edition: "Enem 2025",
        examBlueprintId: blueprint.id,
        questions: [45, 45, 45],
        source: { title: null, url: "https://www.gov.br/inep/provas" },
        subjects: lookup?.subjects ?? [],
      }),
    ]);

    const stored = await readStructure(blueprint.id);

    expect(stored.pastOptions?.options).toBe(5);
    expect(stored.pastQuestions?.subjects).toHaveLength(3);
  });
});
