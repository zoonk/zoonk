import { writeWritingPrompt } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { type ExamStructure, examStructureSchema } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { admitWritingPromptWork } from "../../library/items/_utils/writing-prompt-spend";
import { getWritingPromptId, writeWritingItem } from "../../library/items/write-writing-item";
import { loadWritingSupply } from "../../library/items/writing-prompt-pool";
import reading from "../choices/_test-utils/cgu-2026-structure.json";
import { CGU_WRITTEN_GRADING } from "../mocks/_test-utils/cgu-written";
import { findMockWriting } from "../mocks/_utils/mock-writing-supply";
import { startAnytimeMock } from "../mocks/start-anytime-mock";
import { writingPromptRunFixture } from "./_test-utils/writing-prompt-run";
import { findWritingPrompts } from "./writing-supply";

// Substitute the model boundary, while the prompt bank, its scope and the mock allocation use the test database.
vi.mock("@zoonk/ai/tasks/items/write-writing-prompt", () => ({ writeWritingPrompt: vi.fn() }));

const SPECIALTY = "Especialidade";
const AUDIT = "Auditoria";
const SYSTEMS = "Tecnologia da Informação – Desenvolvimento de Sistemas";
const WRITTEN_TEST = { area: null, day: null, kind: "written" } as const;

const CGU = examStructureSchema.parse(reading);

const COMPLEMENTARY = CGU.subjects
  .filter((subject) => subject.group === "Conhecimentos complementares (P2)")
  .map((subject) => subject.name);

const SPECIALTIES = CGU.subjects
  .filter((subject) => subject.choiceGroup === SPECIALTY)
  .map((subject) => subject.name);

function cguStructure(): ExamStructure {
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
                const own = tasks[index] ?? { key: `task-${index}` };

                return { ...task, ...own, grading: CGU_WRITTEN_GRADING };
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
      aspects: [{ criterionId: "case", description: "Apply the rule", points: 1, steps: null }],
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
  const { itemId, write } = await writingPromptRunFixture({
    ...learner,
    count,
    taskKey,
    unit: "answer",
  });

  await write();
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

  it("requires a guest reservation for the slot and replays the saved prompt without charging again", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure() });
    const guest = await learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT });
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.userId } });
    const input = { ...guest, count: 2, taskKey: "long", unit: "answer" as const };
    const runId = crypto.randomUUID();
    const supply = await loadWritingSupply(input);

    if (!supply) {
      throw new Error("Expected a writing prompt pool.");
    }

    const { poolToken } = supply;
    const write = (slot: number) => writeWritingItem({ input, poolToken, runId, slot });
    const day = new Date("2040-11-23");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day);

    try {
      await expect(write(0)).rejects.toThrow("Writing prompt slot has no spend reservation.");
      expect(writeWritingPrompt).not.toHaveBeenCalled();

      await expect(admitWritingPromptWork({ input, poolToken, runId })).resolves.toStrictEqual({
        count: 2,
        status: "writing",
      });

      await expect(write(2)).rejects.toThrow("Writing prompt slot has no spend reservation.");
      expect(writeWritingPrompt).not.toHaveBeenCalled();

      await write(0);
      await write(0);
      expect(writeWritingPrompt).toHaveBeenCalledOnce();

      await expect(
        prisma.item.count({ where: { id: getWritingPromptId(runId, 0) } }),
      ).resolves.toBe(1);

      await expect(prisma.guestSpendDay.findUnique({ where: { day } })).resolves.toMatchObject({
        spentMicros: 20_000,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes each specialty its own 60-line question, in practice and in the written test", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure() });
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
    const structure = cguStructure();

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

  it("offers the shared question while the learner has no specialty and waits for the case", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure() });
    const learner = await learnerFixture({ blueprintId: blueprint.id, specialty: null });

    const caseId = await writePrompt(learner, "long");
    expect(writeWritingPrompt).not.toHaveBeenCalled();
    await expect(prisma.item.findUnique({ where: { id: caseId } })).resolves.toBeNull();

    const questionId = await writePrompt(learner, "short");
    expect(lastWriterInput()).toMatchObject({ choices: [], subject: { name: COMPLEMENTARY[0] } });

    await expect(findPrompt(learner, "short")).resolves.toStrictEqual({
      itemIds: [questionId],
      status: "ready",
    });
  });

  it.each([false, true])(
    "spreads the common question across all five P2 subjects after reread=%s",
    async (reread) => {
      const structure = reread ? cguStructure() : CGU;
      const [task] = listWrittenTasks({ structure });

      if (!task) {
        throw new Error("Expected the common question");
      }

      const blueprint = await examBlueprintFixture({ structure });

      const [auditor, developer] = await Promise.all([
        learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT }),
        learnerFixture({ blueprintId: blueprint.id, specialty: SYSTEMS }),
      ]);

      const first = await writePrompt(auditor, task.key);
      await expect(readWriting(first)).resolves.not.toHaveProperty("chosenSubjects");

      await expect(findPrompt(developer, task.key)).resolves.toStrictEqual({
        itemIds: [first],
        status: "ready",
      });

      for (const index of COMPLEMENTARY.slice(1).keys()) {
        // oxlint-disable-next-line no-await-in-loop -- Each write rotates away from subjects used by the preceding writes.
        await writePrompt(developer, task.key, index + 2);
      }

      expect(
        vi.mocked(writeWritingPrompt).mock.calls.map(([request]) => request.input.subject?.name),
      ).toStrictEqual(COMPLEMENTARY);
    },
  );

  it("gives a learner who changes specialty the new specialty's prompts and keeps the issued ones", async () => {
    const blueprint = await examBlueprintFixture({ structure: cguStructure() });
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

  it.each([false, true])(
    "starts the written test only with an unseen prompt for each task after reread=%s",
    async (reread) => {
      const structure = reread ? cguStructure() : CGU;
      const blueprint = await examBlueprintFixture({ structure });

      const [auditor, developer, pending] = await Promise.all([
        learnerFixture({ blueprintId: blueprint.id, specialty: AUDIT }),
        learnerFixture({ blueprintId: blueprint.id, specialty: SYSTEMS }),
        learnerFixture({ blueprintId: blueprint.id, specialty: null }),
      ]);

      const [short, long] = listWrittenTasks({ structure });

      if (!short || !long) {
        throw new Error("Expected both questions");
      }

      const auditCase = await writePrompt(auditor, long.key);

      expect(lastWriterInput()).toMatchObject({
        choices: [{ group: SPECIALTY, subject: AUDIT }],
        subject: { name: AUDIT, topics: expect.arrayContaining([expect.any(String)]) },
      });

      await expect(readWriting(auditCase)).resolves.toMatchObject({ chosenSubjects: [AUDIT] });
      await expect(findPrompt(developer, long.key)).resolves.toMatchObject({ status: "missing" });

      const pendingCase = await writePrompt(pending, long.key);
      await expect(prisma.item.findUnique({ where: { id: pendingCase } })).resolves.toBeNull();

      const common = await writePrompt(pending, short.key);
      expect(lastWriterInput()).toMatchObject({ choices: [], subject: { name: COMPLEMENTARY[0] } });

      await expect(findPrompt(developer, short.key)).resolves.toStrictEqual({
        itemIds: [common],
        status: "ready",
      });

      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: developer.userId, status: "active" },
      });

      mockSession(developer.userId);

      const start = () =>
        startAnytimeMock({ goalId: developer.goalId, input: { shape: WRITTEN_TEST } });

      await expect(start()).resolves.toStrictEqual({ status: "preparing" });

      const systemsCase = await writePrompt(developer, long.key);

      expect(lastWriterInput()).toMatchObject({
        choices: [{ group: SPECIALTY, subject: SYSTEMS }],
        subject: {
          name: SYSTEMS,
          topics: CGU.subjects.find(({ name }) => name === SYSTEMS)?.topics,
        },
        task: { lines: reread ? 60 : null },
      });

      await expect(findPrompt(auditor, long.key)).resolves.toStrictEqual({
        itemIds: [auditCase],
        status: "ready",
      });

      await prisma.writingAdmission.create({
        data: {
          extra: false,
          id: crypto.randomUUID(),
          itemIds: [common],
          localDate: new Date(),
          userId: developer.userId,
        },
      });

      await expect(start()).resolves.toStrictEqual({ status: "preparing" });

      const unseen = await writePrompt(developer, short.key);
      expect(lastWriterInput()).toMatchObject({ choices: [], subject: { name: COMPLEMENTARY[1] } });

      const result = await start();

      if (result.status !== "started") {
        throw new Error(result.status);
      }

      await expect(prisma.mockExam.findUnique({ where: { id: result.id } })).resolves.toMatchObject(
        { conditions: { sections: [{ essays: [unseen, systemsCase], minutes: 210 }] } },
      );
    },
  );

  it("shares every prompt of an exam without a choice, as before", async () => {
    const linked = cguStructure();

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
