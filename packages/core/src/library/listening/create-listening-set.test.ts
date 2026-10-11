import { randomUUID } from "node:crypto";
import { type ListeningSet } from "@zoonk/ai/tasks/v2/listening/schema";
import { writeListeningSet } from "@zoonk/ai/tasks/v2/listening/write-set";
import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it, vi } from "vitest";
import { generatedProvenance } from "../items/_test-utils/generated-items";
import { createListeningSet } from "./create-listening-set";
import { listeningContentSchema } from "./listening-content";

// The writer is a paid model call: its set is faked, and storing it runs for real.
vi.mock("@zoonk/ai/tasks/v2/listening/write-set", () => ({ writeListeningSet: vi.fn() }));

const PART = {
  count: 2,
  plays: 1 as const,
  task: "Part 1: a conversation between two people in an everyday social context",
};

function choice({ evidence, skill }: { evidence: string; skill: number }) {
  return {
    context: null,
    difficulty: "medium" as const,
    evidence,
    format: "multipleChoice" as const,
    options: [
      {
        isCorrect: true,
        misconception: null,
        reason: "Said after the correction.",
        text: "Thursday",
      },
      {
        isCorrect: false,
        misconception: "Picks the first day mentioned",
        reason: "Tuesday was corrected.",
        text: "Tuesday",
      },
      {
        isCorrect: false,
        misconception: "Picks a day never said",
        reason: "Nobody says Friday.",
        text: "Friday",
      },
    ],
    question: `Which day does Tom book? ${randomUUID()}`,
    skill,
  };
}

function writtenSet(): ListeningSet {
  return {
    questions: [
      choice({ evidence: "Thursday the twelfth", skill: 2 }),
      // A skill number off the list goes to the first skill.
      choice({ evidence: "the small hall", skill: 7 }),
    ],
    speakers: [
      { accent: "British English", gender: "female", name: "Receptionist" },
      { accent: "Australian English", gender: "male", name: "Tom" },
    ],
    title: "Booking a hall",
    turns: [
      { speaker: "Receptionist", text: "Good morning, Riverside Sports Centre." },
      { speaker: "Tom", text: "I'd like to book the small hall, please." },
      { speaker: "Receptionist", text: "Which day?" },
      { speaker: "Tom", text: "Tuesday, no, sorry, Thursday the twelfth." },
    ],
  };
}

function writes({ problems = [] }: { problems?: string[] } = {}) {
  const set = writtenSet();
  const provenance = generatedProvenance();

  vi.mocked(writeListeningSet).mockResolvedValue({
    data: { problems, set },
    provenance: { ...provenance, latencyMs: 1000, provider: "openai", requestedModel: "test" },
    systemPrompt: "",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    userPrompt: "",
  } as Awaited<ReturnType<typeof writeListeningSet>>);

  return { provenance, set };
}

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
    const { provenance, set } = writes();
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
    const { provenance } = writes({ problems: ["Question 2's evidence isn't in the script."] });

    await expect(createListeningSet(await inputs())).resolves.toBeNull();
    await expect(prisma.itemSet.count({ where: { runId: provenance.runId } })).resolves.toBe(0);
  });

  it("writes nothing for a part whose exam has no listening skills", async () => {
    const input = await inputs();

    await expect(createListeningSet({ ...input, skills: [] })).resolves.toBeNull();
    expect(writeListeningSet).not.toHaveBeenCalled();
  });
});
