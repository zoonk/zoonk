import { randomUUID } from "node:crypto";
import { generateSetupLessonOutline } from "@zoonk/ai/tasks/v2/curriculum/setup-lesson-outline";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { choosePlanTools } from "./choose-plan-tools";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";
import { getPlanLink } from "./get-plan-link";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The model call is the one external boundary; each test says what the model wrote. */
vi.mock("@zoonk/ai/tasks/v2/curriculum/setup-lesson-outline", () => ({
  generateSetupLessonOutline: vi.fn(),
}));

/** A Monday in 2020, before other tests' learning events, so pace estimates stay out of it. */
const NOW = new Date("2020-09-28T12:00:00Z");

function mockOutline(title: string) {
  vi.mocked(generateSetupLessonOutline).mockResolvedValue({
    data: {
      canDo: "Run a line of Python in the terminal",
      description: "Install Python from python.org and check it runs.",
      estimatedMinutes: 4,
      skill: title,
      title,
    },
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: "run-test",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

/**
 * A plan over two chapters, basics then practice. Tool names are unique per test, so the shared
 * setup lessons one test writes never meet another test's.
 */
async function setup() {
  const user = await userFixture();
  const word = randomUUID().slice(0, 8);
  const tools = { python: `Python ${word}`, spreadsheet: `Spreadsheet ${word} (Sheets or Excel)` };

  const library = await planLibraryFixture({
    phases: ["Basics", "Practice"],
    skills: [
      { lessons: 2, phase: 0 },
      { lessons: 2, phase: 1 },
    ],
  });

  const [basics, practice] = library.chapters;

  await Promise.all([
    prisma.chapter.update({
      data: { tools: [{ essential: false, name: tools.spreadsheet }] },
      where: { id: basics?.id },
    }),
    prisma.chapter.update({
      data: {
        tools: [
          { essential: false, name: tools.python },
          { essential: true, name: tools.spreadsheet.toLowerCase() },
        ],
      },
      where: { id: practice?.id },
    }),
    libraryChapterFixture({ tools: [{ essential: true, name: `R ${word}` }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, tools, user };
}

async function loadTools(goalId: string) {
  const result = await getGoalPlan(goalId);
  return result.status === "ready" ? result.plan.tools : null;
}

async function loadPlanItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

describe(choosePlanTools, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(generateSetupLessonOutline).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists only the plan's tools, one per tool: this phase's first, later phases' after", async () => {
    const { goal, tools } = await setup();

    // The spreadsheet is used from the first phase on; Python only once practice starts.
    await expect(loadTools(goal.id)).resolves.toStrictEqual([
      { choice: null, essential: true, later: false, name: tools.spreadsheet, system: null },
      { choice: null, essential: false, later: true, name: tools.python, system: null },
    ]);
  });

  it("lists no tools for an exam answered on paper, and the plan's tools for a practical exam", async () => {
    const { goal } = await setup();
    const citation = { passage: "passage", sourceId: "source" };

    const written = await examBlueprintFixture({
      structure: {
        formats: [
          { citation, description: "Itens de certo ou errado", kind: "trueFalse", options: null },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    await prisma.goal.update({
      data: { examBlueprintId: written.id, kind: "exam" },
      where: { id: goal.id },
    });

    await expect(loadTools(goal.id)).resolves.toStrictEqual([]);

    const practical = await examBlueprintFixture({
      structure: {
        formats: [
          {
            citation,
            description: "Prova prática no computador",
            kind: "practical",
            options: null,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    await prisma.goal.update({ data: { examBlueprintId: practical.id }, where: { id: goal.id } });

    await expect(loadTools(goal.id)).resolves.toHaveLength(2);
  });

  it("adds one shared setup lesson before the first chapter that needs the tool, with an undo", async () => {
    const { goal, library, plan, tools } = await setup();
    const title = `Set up ${tools.python} on Windows`;
    mockOutline(title);

    const input = { choice: "setup" as const, system: "windows" as const, tools: [tools.python] };
    const first = await choosePlanTools({ goalId: goal.id, input });

    expect(first).toMatchObject({
      change: { canUndo: true, operations: [{ kind: "setTools" }, { kind: "addSkills" }] },
      status: "applied",
    });

    await choosePlanTools({ goalId: goal.id, input });
    expect(generateSetupLessonOutline).toHaveBeenCalledOnce();

    const skill = await prisma.skill.findUniqueOrThrow({
      include: { lessons: { include: { lesson: true } } },
      where: {
        languageIdentity: {
          identityKey: buildSetupSkillIdentityKey({ system: "windows", tool: tools.python }),
          language: "en",
        },
      },
    });

    expect(skill.lessons.map((entry) => entry.lesson)).toMatchObject([
      {
        canDo: "Run a line of Python in the terminal",
        homeChapterId: null,
        title,
        visibility: "public",
      },
    ]);

    const items = await loadPlanItems(plan.id);
    const setupItems = items.filter((item) => item.skillId === skill.id);
    const [basics, practice] = library.chapters;
    const lastBasics = items.findLast((item) => item.chapterId === basics?.id);
    const firstPractice = items.find((item) => item.chapterId === practice?.id);

    expect(setupItems).toHaveLength(1);
    expect(setupItems[0]?.lessonId).toBe(skill.lessons[0]?.lessonId);
    expect(setupItems[0]?.titleSnapshot).toBe(title);
    expect(setupItems[0]?.position).toBeGreaterThan(lastBasics?.position ?? Infinity);
    expect(setupItems[0]?.position).toBeLessThan(firstPractice?.position ?? -1);

    await expect(loadTools(goal.id)).resolves.toContainEqual({
      choice: "setup",
      essential: false,
      later: true,
      name: tools.python,
      system: "windows",
    });

    // The learner's device is their own answer: a shared link leaves the setup lesson out.
    await expect(getPlanLink(plan.id)).resolves.toMatchObject({
      outline: { skillCount: library.graph.skills.length },
    });

    const have = await choosePlanTools({
      goalId: goal.id,
      input: { choice: "have", system: null, tools: [tools.python] },
    });

    const afterHave = await loadPlanItems(plan.id);
    expect(afterHave.some((item) => item.skillId === skill.id)).toBe(false);

    await decidePlanChange({
      changeId: have.status === "applied" ? (have.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    const afterUndo = await loadPlanItems(plan.id);
    expect(afterUndo.filter((item) => item.skillId === skill.id)).toHaveLength(1);
  });

  it("goes without every tool at once and takes back setup lessons", async () => {
    const { goal, plan, tools } = await setup();
    mockOutline(`Set up ${tools.spreadsheet} on a Mac`);

    await choosePlanTools({
      goalId: goal.id,
      input: { choice: "setup", system: "macos", tools: [tools.spreadsheet] },
    });

    const none = await choosePlanTools({
      goalId: goal.id,
      input: { choice: "none", system: null, tools: [tools.spreadsheet, tools.python] },
    });

    expect(none.status).toBe("applied");

    const [items, saved] = await Promise.all([
      loadPlanItems(plan.id),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    ]);

    expect(items.some((item) => item.titleSnapshot.startsWith("Set up"))).toBe(false);

    expect(saved.settings).toMatchObject({
      tools: [
        { choice: "none", name: tools.spreadsheet, setupSkillId: null, system: null },
        { choice: "none", name: tools.python, setupSkillId: null, system: null },
      ],
    });
  });

  it("refuses tools the plan doesn't use and other learners' plans", async () => {
    const { goal, tools } = await setup();

    await expect(
      choosePlanTools({
        goalId: goal.id,
        input: { choice: "have", system: null, tools: ["Photoshop"] },
      }),
    ).resolves.toStrictEqual({ error: "unknownTool", status: "invalid" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(
      choosePlanTools({
        goalId: goal.id,
        input: { choice: "have", system: null, tools: [tools.python] },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    expect(generateSetupLessonOutline).not.toHaveBeenCalled();
  });

  it("keeps the setup lesson private when only private chapters use the tool", async () => {
    const { goal, library, user } = await setup();
    const tool = `Our CRM ${randomUUID().slice(0, 8)}`;
    mockOutline(`Set up ${tool} on Windows`);

    await prisma.chapter.update({
      data: { ownerId: user.id, tools: [{ essential: true, name: tool }], visibility: "private" },
      where: { id: library.chapters[1]?.id },
    });

    await choosePlanTools({
      goalId: goal.id,
      input: { choice: "setup", system: "windows", tools: [tool] },
    });

    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { title: `Set up ${tool} on Windows` },
    });

    expect(lesson).toMatchObject({ ownerId: user.id, visibility: "private" });
  });
});
