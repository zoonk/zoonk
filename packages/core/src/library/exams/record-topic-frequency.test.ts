import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { examStructureSchema } from "./blueprint-contract";
import { findTopicFrequencyLookup, recordTopicFrequency } from "./record-topic-frequency";
import { listTopicLevels } from "./topic-frequency";

const citation = { passage: "…", sourceId: "notice" };

const NATUREZA = [
  "Moléculas, células e tecidos",
  "Hereditariedade e diversidade da vida",
  "Ecologia e ciências ambientais",
  "A Mecânica e o funcionamento do Universo",
];

function subject(name: string, topics: string[]) {
  return { citation, group: null, name, questions: 45, shortName: null, topics, weight: null };
}

const structure = {
  formats: [{ citation, description: "Cinco opções", kind: "multipleChoice", options: 5 }],
  mock: null,
  rules: [],
  subjects: [
    subject("Ciências da Natureza e suas Tecnologias", NATUREZA),
    subject("Redação", ["Texto dissertativo-argumentativo"]),
  ],
};

describe(recordTopicFrequency, () => {
  it("looks up how often a shared exam's topics are asked once, and the plan then reads it", async () => {
    const blueprint = await examBlueprintFixture({ name: "ENEM", role: null, structure });

    await expect(
      findTopicFrequencyLookup({ examBlueprintId: blueprint.id }),
    ).resolves.toStrictEqual({
      board: blueprint.board,
      exam: "ENEM",
      subjects: [{ name: "Ciências da Natureza e suas Tecnologias", topics: NATUREZA }],
    });

    await recordTopicFrequency({
      examBlueprintId: blueprint.id,
      subjects: [
        {
          basis: "questões de 2009 a 2024",
          name: "Ciências da Natureza e suas Tecnologias",
          source: { title: "Assuntos que mais caem", url: "https://example.com/enem" },
          topics: [
            { appearances: 41, level: "high", topic: "Hereditariedade e diversidade da vida" },
          ],
        },
      ],
    });

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });

    expect(
      listTopicLevels({
        structure: examStructureSchema.parse(stored.structure),
        topicFrequency: [],
      }),
    ).toStrictEqual([
      {
        level: "high",
        subject: "Ciências da Natureza e suas Tecnologias",
        topic: "Hereditariedade e diversidade da vida",
      },
    ]);

    await expect(findTopicFrequencyLookup({ examBlueprintId: blueprint.id })).resolves.toBeNull();

    // A later lookup that finds nothing keeps what the earlier one found.
    await recordTopicFrequency({ examBlueprintId: blueprint.id, subjects: [] });

    const again = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });

    expect(
      examStructureSchema
        .parse(again.structure)
        .pastTopicFrequency?.subjects.map((item) => item.name),
    ).toStrictEqual(["Ciências da Natureza e suas Tecnologias"]);
  });

  it("never looks up a private blueprint read from a learner's material", async () => {
    const owner = await userFixture();
    const blueprint = await examBlueprintFixture({ ownerId: owner.id, structure });

    await expect(findTopicFrequencyLookup({ examBlueprintId: blueprint.id })).resolves.toBeNull();
  });
});
