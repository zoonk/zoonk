import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { getWritingPromptId, writeWritingItem } from "../../library/items/write-writing-item";
import reading from "../choices/_test-utils/cgu-2026-structure.json";
import { CGU_WRITTEN_GRADING } from "../mocks/_test-utils/cgu-written";
import { findMockWriting } from "../mocks/_utils/mock-writing-supply";
import { findWritingPrompts } from "./writing-supply";

// Substitute the model boundary, while the prompt bank, its scope and the mock allocation use the test database.
vi.mock("@zoonk/ai/tasks/items/write-writing-prompt", () => ({ writeWritingPrompt: vi.fn() }));

const SPECIALTY = "Especialidade";
const AUDIT = "Auditoria";
const SYSTEMS = "Tecnologia da Informação – Desenvolvimento de Sistemas";
const WRITTEN_TEST = { day: null, kind: "written" } as const;

const CGU = examStructureSchema.parse(reading);

const COMPLEMENTARY = CGU.subjects
  .filter((subject) => subject.group === "Conhecimentos complementares (P2)")
  .map((subject) => subject.name);

const SPECIALTIES = CGU.subjects
  .filter((subject) => subject.choiceGroup === SPECIALTY)
  .map((subject) => subject.name);

function cguStructure({ linked }: { linked: boolean }): ExamStructure {
  const tasks = [
    { key: "short", lines: 30, points: 30, subjects: COMPLEMENTARY },
    { key: "long", lines: 60, points: 70, subjects: SPECIALTIES },
  ];

  return {
    ...CGU,
    mock: CGU.mock && {
      ...CGU.mock,
      sections: CGU.mock.sections.map((section) =>
        section.kind === "written"
          ? {
              ...section,
              tasks: section.tasks?.map((task, index) => {
                const { subjects, ...own } = tasks[index] ?? { key: `task-${index}` };

                return {
                  ...task,
                  ...own,
                  grading: CGU_WRITTEN_GRADING,
                  ...(linked && { subjects }),
                };
              }),
            }
          : section,
      ),
    },
  };
}

function useWriter() {
  vi.mocked(writeWritingPrompt, { partial: true }).mockImplementation(async ({ input }) => ({
    data: {
      aspects: [{ criterionId: "case", description: "Apply the rule", points: 1 }],
      assessedSkillIds: input.skills.map(({ id }) => id),
      context: null,
      criteria: [{ id: "case", name: "Application", points: 1 }],
      keyPoints: ["Apply the rule"],
      question: `A question on ${input.subject?.name ?? input.task.description}`,
      sampleOutline: "State the rule, then apply it.",
      title: `Question ${crypto.randomUUID()}`,
    },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "fixture",
      promptVersion: "fixture",
      provider: "fixture",
      requestedModel: "fixture",
      runId: "fixture",
      usage: {},
    },
  }));
}

async function learnerFixture({
  blueprintId,
  specialty,
}: {
  blueprintId: string;
  specialty: string | null;
}) {
  const user = await userFixture();

  const goal = await goalFixture({
    examBlueprintId: blueprintId,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: { phases: [], skills: [] },
    settings: specialty ? { examChoices: [{ group: SPECIALTY, subjects: [specialty] }] } : {},
  });

  return { goalId: goal.id, userId: user.id };
}

type Learner = Awaited<ReturnType<typeof learnerFixture>>;

/** `count` is how many unseen prompts the learner wants, so a pool they already have grows by one. */
async function writePrompt(learner: Learner, taskKey: string, count = 1) {
  const itemId = getWritingPromptId(crypto.randomUUID(), 0);
  await writeWritingItem({ ...learner, count, taskKey, unit: "answer" }, itemId);
  return itemId;
}

function findPrompt(learner: Learner, taskKey: string) {
  return findWritingPrompts({
    ...learner,
    requests: [{ count: 1, taskKey, unit: "answer" }],
    tx: prisma,
  });
}

function lastWriterInput() {
  return vi.mocked(writeWritingPrompt).mock.lastCall?.[0].input;
}

async function readWriting(itemId: string) {
  const item = await prisma.item.findUniqueOrThrow({
    select: { content: true },
    where: { id: itemId },
  });

  return (item.content as { writing: Record<string, unknown> }).writing;
}

describe("written tasks scoped to the learner's subjects", () => {
  beforeEach(() => {
    vi.mocked(writeWritingPrompt).mockReset();
    useWriter();
  });

  it("writes each specialty its own 60-line question, in practice and in the written test", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure({ linked: true }) });
    const auditor = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });
    const developer = await learnerFixture({ blueprintId: blueprint.id, specialty: SYSTEMS });
    const secondAuditor = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });

    const auditCase = await writePrompt(auditor, "long");

    expect(lastWriterInput()).toMatchObject({
      choices: [{ group: SPECIALTY, subject: AUDIT }],
      subject: { name: AUDIT },
    });

    await expect(readWriting(auditCase)).resolves.toMatchObject({
      chosenSubjects: [AUDIT],
      lines: 60,
      subject: AUDIT,
    });

    await expect(findPrompt(developer, "long")).resolves.toMatchObject({ status: "missing" });

    await expect(findPrompt(secondAuditor, "long")).resolves.toStrictEqual({
      itemIds: [auditCase],
      status: "ready",
    });

    const systemsCase = await writePrompt(developer, "long");

    expect(lastWriterInput()).toMatchObject({
      choices: [{ group: SPECIALTY, subject: SYSTEMS }],
      subject: { name: SYSTEMS },
    });

    const question = await writePrompt(auditor, "short");
    const structure = cguStructure({ linked: true });

    await expect(
      findMockWriting({ ...auditor, shape: WRITTEN_TEST, structure }),
    ).resolves.toStrictEqual({
      essays: [
        { itemId: question, taskKey: "short" },
        { itemId: auditCase, taskKey: "long" },
      ],
      status: "ready",
    });

    await expect(
      findMockWriting({ ...developer, shape: WRITTEN_TEST, structure }),
    ).resolves.toStrictEqual({
      essays: [
        { itemId: question, taskKey: "short" },
        { itemId: systemsCase, taskKey: "long" },
      ],
      status: "ready",
    });
  });

  it("spreads the 30-line question across the complementary subjects, shared by every specialty", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure({ linked: true }) });
    const auditor = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });
    const developer = await learnerFixture({ blueprintId: blueprint.id, specialty: SYSTEMS });

    const first = await writePrompt(auditor, "short");
    expect(lastWriterInput()).toMatchObject({ choices: [], subject: { name: COMPLEMENTARY[0] } });
    await expect(readWriting(first)).resolves.not.toHaveProperty("chosenSubjects");

    await expect(findPrompt(developer, "short")).resolves.toStrictEqual({
      itemIds: [first],
      status: "ready",
    });

    await writePrompt(developer, "short", 2);
    expect(lastWriterInput()).toMatchObject({ subject: { name: COMPLEMENTARY[1] } });

    await writePrompt(auditor, "short", 3);

    expect(lastWriterInput()).toMatchObject({
      subject: { name: COMPLEMENTARY[2] },
      usedTitles: expect.arrayContaining([expect.any(String), expect.any(String)]),
    });
  });

  it("gives a learner who changes specialty the new specialty's prompts and keeps the issued ones", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure({ linked: true }) });
    const learner = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });
    const developer = await learnerFixture({ blueprintId: blueprint.id, specialty: SYSTEMS });

    const auditCase = await writePrompt(learner, "long");
    const systemsCase = await writePrompt(developer, "long");

    await prisma.plan.update({
      data: { settings: { examChoices: [{ group: SPECIALTY, subjects: [SYSTEMS] }] } },
      where: { goalId: learner.goalId },
    });

    await expect(findPrompt(learner, "long")).resolves.toStrictEqual({
      itemIds: [systemsCase],
      status: "ready",
    });

    await expect(readWriting(auditCase)).resolves.toMatchObject({ chosenSubjects: [AUDIT] });
  });

  it("never shares a prompt across specialties before the notice is read again", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure({ linked: false }) });
    const auditor = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });
    const developer = await learnerFixture({ blueprintId: blueprint.id, specialty: SYSTEMS });
    const secondAuditor = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });

    const auditCase = await writePrompt(auditor, "long");

    expect(lastWriterInput()).toMatchObject({
      choices: [{ group: SPECIALTY, subject: AUDIT }],
      subject: null,
      task: { description: expect.stringContaining("especialidade") },
    });

    await expect(findPrompt(developer, "long")).resolves.toMatchObject({ status: "missing" });

    await expect(findPrompt(secondAuditor, "long")).resolves.toStrictEqual({
      itemIds: [auditCase],
      status: "ready",
    });

    await writePrompt(developer, "long");
    expect(lastWriterInput()).toMatchObject({ choices: [{ group: SPECIALTY, subject: SYSTEMS }] });
  });

  it("shares every prompt of an exam without a choice, as before", async () => {
    const linked = cguStructure({ linked: true });

    const blueprint = await examBlueprintFixture({
      structure: {
        ...linked,
        subjects: linked.subjects.filter((subject) => subject.choiceGroup !== SPECIALTY),
      },
    });

    const first = await learnerFixture({ blueprintId: blueprint.id, specialty: null });
    const second = await learnerFixture({ blueprintId: blueprint.id, specialty: null });

    const itemId = await writePrompt(first, "long");

    expect(lastWriterInput()).toMatchObject({ choices: [], subject: null });
    await expect(readWriting(itemId)).resolves.not.toHaveProperty("chosenSubjects");

    await expect(findPrompt(second, "long")).resolves.toStrictEqual({
      itemIds: [itemId],
      status: "ready",
    });
  });
});
