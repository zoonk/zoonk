import { writeListeningSet } from "@zoonk/ai/tasks/listening/write-set";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { mockWrittenListeningSet } from "./_test-utils/written-listening-set";
import { listeningContentSchema } from "./listening-content";
import { writeExamListeningSet } from "./write-exam-listening-set";

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

describe(writeExamListeningSet, () => {
  it("writes the part's recording from the exam's words, each question on its skill", async () => {
    const { provenance, set } = mockWrittenListeningSet();
    const input = await inputs();

    const written = await writeExamListeningSet({ ...input, serviceTier: "flex" });

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

    expect(written).toMatchObject({
      examBlueprintId: input.exam.blueprintId,
      kind: "audio",
      language: "pt",
      optionLanguage: "en",
      provenance: { runId: provenance.runId },
    });

    expect(listeningContentSchema.parse(written?.content)).toMatchObject({
      plays: 1,
      script: { turns: set.turns },
      scriptLanguage: "en",
      task: PART.task,
      title: "Booking a hall",
    });

    expect(written?.items.map((item) => item.skillId)).toStrictEqual([
      input.skills[1]?.skillId,
      input.skills[0]?.skillId,
    ]);
  });

  it("returns nothing when the writer couldn't make the set clean", async () => {
    mockWrittenListeningSet({ problems: ["Question 2's evidence isn't in the script."] });

    await expect(writeExamListeningSet(await inputs())).resolves.toBeNull();
  });

  it("writes nothing for a part whose exam has no listening skills", async () => {
    const input = await inputs();

    await expect(writeExamListeningSet({ ...input, skills: [] })).resolves.toBeNull();
    expect(writeListeningSet).not.toHaveBeenCalled();
  });
});
