import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { examStructureSchema } from "./blueprint-contract";
import { findSubjectQuestionsLookup, recordSubjectQuestions } from "./record-subject-questions";

const citation = { passage: "…", sourceId: "notice" };

function subject(name: string) {
  return {
    citation,
    group: null,
    name,
    questions: null,
    shortName: null,
    topics: [],
    weight: null,
  };
}

const structure = {
  formats: [{ citation, description: "Quatro opções", kind: "multipleChoice", options: 4 }],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Um ponto por questão", method: "raw" },
    sections: [],
    timeLimitMinutes: 300,
    totalQuestions: 80,
  },
  rules: [],
  subjects: [subject("Direito Civil"), subject("Direito Penal"), subject("Ética Profissional")],
};

describe(recordSubjectQuestions, () => {
  it("looks up a shared exam's subject counts once, and the subjects then carry them", async () => {
    const blueprint = await examBlueprintFixture({
      name: "OAB Exame de Ordem Unificado",
      role: "1ª fase",
      structure,
    });

    await expect(
      findSubjectQuestionsLookup({ examBlueprintId: blueprint.id }),
    ).resolves.toStrictEqual({
      board: blueprint.board,
      exam: "OAB Exame de Ordem Unificado, 1ª fase",
      subjects: ["Direito Civil", "Direito Penal", "Ética Profissional"],
      total: 80,
    });

    await recordSubjectQuestions({
      edition: "45º Exame",
      examBlueprintId: blueprint.id,
      questions: [7, 6, 8],
      source: { title: "Distribuição", url: "https://example.com/oab" },
      subjects: ["Direito Civil", "Direito Penal", "Ética Profissional"],
    });

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });

    expect(examStructureSchema.parse(stored.structure).pastQuestions).toMatchObject({
      edition: "45º Exame",
      subjects: [
        { name: "Direito Civil", questions: 7 },
        { name: "Direito Penal", questions: 6 },
        { name: "Ética Profissional", questions: 8 },
      ],
    });

    await expect(findSubjectQuestionsLookup({ examBlueprintId: blueprint.id })).resolves.toBeNull();
  });

  it("never looks up a private blueprint read from a learner's material", async () => {
    const owner = await userFixture();

    const blueprint = await examBlueprintFixture({
      ownerId: owner.id,
      structure,
      visibility: "private",
    });

    await expect(findSubjectQuestionsLookup({ examBlueprintId: blueprint.id })).resolves.toBeNull();
  });
});
