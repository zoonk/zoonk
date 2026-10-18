import { writeListeningSet } from "@zoonk/ai/tasks/v2/listening/write-set";
import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { mockWrittenListeningSet } from "./_test-utils/written-listening-set";
import { createListeningSet } from "./create-listening-set";
import { listeningContentSchema } from "./listening-content";

const PART = {
  count: 2,
  plays: 1 as const,
  task: "Part 1: a conversation between two people in an everyday social context",
};

async function inputs() {
  const [blueprint, detail, gist] = await Promise.all([
    examBlueprintFixture(),
    skillFixture({ name: "Note specific details" }),
    skillFixture({ name: "Follow a conversation's decisions" }),
  ]);

  return {
    exam: { blueprintId: blueprint.id, name: "IELTS Academic" },
    language: "pt",
    part: PART,
    scriptLanguage: "en",
    skills: [
      { description: detail.description, name: detail.name, skillId: detail.id },
      { description: gist.description, name: gist.name, skillId: gist.id },
    ],
  };
}

describe(createListeningSet, () => {
  it("writes the part's recording from the exam's words and stores it unvoiced, each question on its skill", async () => {
    const { provenance, set } = mockWrittenListeningSet();
    const input = await inputs();

    const setId = await createListeningSet({ ...input, serviceTier: "flex" });

    expect(writeListeningSet).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: { contentScope: "shared" },
        count: 2,
        exam: "IELTS Academic",
        language: "pt",
        plays: 1,
        scriptLanguage: "en",
        serviceTier: "flex",
        skills: input.skills,
        task: PART.task,
      }),
    );

    const stored = await prisma.itemSet.findUniqueOrThrow({
      include: { items: { orderBy: { setPosition: "asc" } } },
      where: { id: setId ?? "" },
    });

    expect(stored).toMatchObject({
      examBlueprintId: input.exam.blueprintId,
      kind: "audio",
      language: "pt",
      mediaAssetId: null,
      runId: provenance.runId,
    });

    expect(listeningContentSchema.parse(stored.content)).toMatchObject({
      plays: 1,
      script: { turns: set.turns },
      scriptLanguage: "en",
      task: PART.task,
      title: "Booking a hall",
    });

    expect(stored.items.map((item) => item.skillId)).toStrictEqual([
      input.skills[1]?.skillId,
      input.skills[0]?.skillId,
    ]);
  });

  it("stores nothing when the writer couldn't make the set clean", async () => {
    const { provenance } = mockWrittenListeningSet({
      problems: ["Question 2's evidence isn't in the script."],
    });

    await expect(createListeningSet(await inputs())).resolves.toBeNull();
    await expect(prisma.itemSet.count({ where: { runId: provenance.runId } })).resolves.toBe(0);
  });

  it("writes nothing for a part whose exam has no listening skills", async () => {
    const input = await inputs();

    await expect(createListeningSet({ ...input, skills: [] })).resolves.toBeNull();
    expect(writeListeningSet).not.toHaveBeenCalled();
  });
});
