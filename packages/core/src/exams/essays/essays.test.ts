import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { DAY_MS, SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { finishStudyBlock } from "../../sessions/finish-study-block";
import { getTodayStudySession } from "../../sessions/get-today-study-session";
import { startStudyBlock } from "../../sessions/start-study-block";
import { getEssay } from "./get-essay";
import { submitEssay } from "./submit-essay";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const GRADE = {
  criteria: [1, 2, 3, 4, 5].map((index) => ({
    comment: `Comment ${index}`,
    example: null,
    id: `c${index}`,
    maxScore: 200,
    name: `C${index}`,
    quote: null,
    score: index === 5 ? 80 : 160,
  })),
  enemInterventionElements: {
    action: true,
    agent: true,
    detail: false,
    effect: true,
    means: false,
  },
  nextStep: { criterionId: "c5", text: "Say by what means." },
  range: { high: 760, low: 680 },
  total: { maxScore: 1000, score: 720 },
  zeroReason: null,
};

const gradeEssay = vi.hoisted(() => vi.fn());

vi.mock("@zoonk/ai/tasks/v2/grading/grade-essay", () => ({ gradeEssay }));

const ESSAY_CONTENT = {
  context: "Theme: fighting disinformation.",
  keyPoints: ["Intervention proposal with five elements"],
  question: "Write an argumentative essay on the theme.",
  rubric: [
    { criterion: "Formal writing", description: "Standard written Portuguese" },
    { criterion: "Proposal", description: "A detailed intervention proposal" },
  ],
  sampleOutline: "Intro, two arguments, proposal.",
};

async function essaySetup() {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    identityKey: `enem-${crypto.randomUUID()}`,
    name: "ENEM",
    structure: {
      formats: [
        {
          citation: { passage: "", sourceId: "n" },
          description: "Essay",
          kind: "essay",
          options: null,
        },
      ],
      mock: null,
      rules: [],
      subjects: [],
    },
  });

  const fixture = await sessionGoalFixture({
    goal: { dailyMinutes: 90, examBlueprintId: blueprint.id, kind: "exam" },
    userId: user.id,
  });

  await itemFixture({
    content: ESSAY_CONTENT,
    examBlueprintId: blueprint.id,
    format: "essay",
    skillId: fixture.skills[0]?.id ?? "",
  });

  mockSession(user.id);
  return { ...fixture, user };
}

const AP_ROWS = [
  { criterion: "Thesis", description: "Makes a historically defensible claim", points: 1 },
  { criterion: "Evidence", description: "Supports the claim with specific evidence", points: 2 },
];

/** An AP exam lists no essays, but free-response questions with pointed rows were written for it. */
async function apSetup() {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    identityKey: `ap-us-history-${crypto.randomUUID()}`,
    name: "AP United States History",
    structure: { formats: [], mock: null, rules: [], subjects: [] },
  });

  const fixture = await sessionGoalFixture({
    goal: { dailyMinutes: 90, examBlueprintId: blueprint.id, kind: "exam" },
    userId: user.id,
  });

  await itemFixture({
    content: { ...ESSAY_CONTENT, rubric: AP_ROWS },
    examBlueprintId: blueprint.id,
    format: "essay",
    skillId: fixture.skills[0]?.id ?? "",
  });

  mockSession(user.id);
  return fixture;
}

/** Today's writing block of a new ENEM goal, started. */
async function startedWritingBlock() {
  const { goal, user } = await essaySetup();
  const today = await getTodayStudySession({ goalId: goal.id });
  const blocks = today.status === "ready" ? today.session.blocks : [];
  const sessionId = today.status === "ready" ? today.session.id : "";
  const blockId = blocks.find((block) => block.kind === "produce")?.id ?? "";
  const otherBlockId = blocks.find((block) => block.kind !== "produce")?.id ?? "";

  if (!blockId || !otherBlockId) {
    throw new Error("Expected a writing block and another block today");
  }

  await startStudyBlock({ blockId, input: {}, sessionId });

  return { blockId, otherBlockId, user };
}

describe("essays in sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
    gradeEssay.mockResolvedValue({ data: GRADE, provenance: null, usage: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    gradeEssay.mockReset();
  });

  it("plans a writing block, grades drafts by the rubric and settles the block", async () => {
    const { goal } = await essaySetup();
    const today = await getTodayStudySession({ goalId: goal.id });

    const block =
      today.status === "ready" ? today.session.blocks.find((b) => b.kind === "produce") : null;

    expect(block).toMatchObject({ estimatedMinutes: 20, kind: "produce", questions: 1 });

    const blockId = block?.id ?? "";
    const sessionId = today.status === "ready" ? today.session.id : "";

    await expect(
      submitEssay({ blockId, input: { durationMs: 1000, text: "Draft" } }),
    ).resolves.toStrictEqual({ status: "blockNotActive" });

    await startStudyBlock({ blockId, input: {}, sessionId });

    await expect(
      submitEssay({ blockId, input: { durationMs: 600_000, text: "My essay about it." } }),
    ).resolves.toMatchObject({ grade: { total: { score: 720 } }, status: "graded" });

    expect(gradeEssay).toHaveBeenCalledWith(
      expect.objectContaining({ essay: "My essay about it.", rubric: { kind: "enem" } }),
    );

    const view = await getEssay({ blockId });

    expect(view).toMatchObject({
      essay: {
        drafts: [{ grade: { nextStep: { criterionId: "c5" } }, text: "My essay about it." }],
        gradesLeft: 5,
        question: ESSAY_CONTENT.question,
        rubric: "enem",
      },
      status: "ready",
    });

    const attempt = await prisma.attempt.findFirstOrThrow({ where: { studySessionId: sessionId } });

    expect(attempt).toMatchObject({ isCorrect: true, score: 0.72 });

    const finished = await finishStudyBlock({ blockId, input: {}, sessionId });

    expect(finished.status).toBe("ready");
  });

  it("practices an AP free-response question and scores it by its rows' points", async () => {
    const { goal } = await apSetup();
    const today = await getTodayStudySession({ goalId: goal.id });

    const block =
      today.status === "ready" ? today.session.blocks.find((b) => b.kind === "produce") : null;

    const blockId = block?.id ?? "";
    const sessionId = today.status === "ready" ? today.session.id : "";

    await startStudyBlock({ blockId, input: {}, sessionId });
    await submitEssay({ blockId, input: { durationMs: 600_000, text: "My answer about it." } });

    expect(gradeEssay).toHaveBeenCalledWith(
      expect.objectContaining({ rubric: { criteria: AP_ROWS, kind: "ap" } }),
    );

    await expect(getEssay({ blockId })).resolves.toMatchObject({ essay: { rubric: "ap" } });
  });

  it("stops grading once the day's essays are used up", async () => {
    const { goal } = await essaySetup();
    const today = await getTodayStudySession({ goalId: goal.id });

    const block =
      today.status === "ready" ? today.session.blocks.find((b) => b.kind === "produce") : null;

    const sessionId = today.status === "ready" ? today.session.id : "";
    const blockId = block?.id ?? "";

    await startStudyBlock({ blockId, input: {}, sessionId });

    const drafts = Array.from({ length: 6 }, (_, index) => index);

    await drafts.reduce(
      (previous) =>
        previous.then(async () => {
          await submitEssay({ blockId, input: { durationMs: 1000, text: "Again" } });
        }),
      Promise.resolve(),
    );

    await expect(
      submitEssay({ blockId, input: { durationMs: 1000, text: "One more" } }),
    ).resolves.toStrictEqual({ status: "limitReached" });
  });
});

describe("essay drafts and access", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
    gradeEssay.mockResolvedValue({ data: GRADE, provenance: null, usage: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    gradeEssay.mockReset();
  });

  it("keeps a writing block to its learner, and only a writing block", async () => {
    const { blockId, otherBlockId } = await startedWritingBlock();
    const input = { durationMs: 1000, text: "Draft" };

    await expect(getEssay({ blockId: otherBlockId })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getEssay({ blockId: "not-a-block" })).resolves.toStrictEqual({
      status: "notFound",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getEssay({ blockId })).resolves.toStrictEqual({ status: "notFound" });
    await expect(submitEssay({ blockId, input })).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);

    await expect(getEssay({ blockId })).resolves.toStrictEqual({ status: "unauthorized" });

    await expect(submitEssay({ blockId, input })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    expect(gradeEssay).not.toHaveBeenCalled();
  });

  it("shows the latest draft first and counts grades left on the learner's own day", async () => {
    const { blockId } = await startedWritingBlock();

    await submitEssay({ blockId, input: { durationMs: 1000, text: "First draft" } });
    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 60_000));
    await submitEssay({ blockId, input: { durationMs: 1000, text: "Second draft" } });

    const view = await getEssay({ blockId });
    const essay = view.status === "ready" ? view.essay : null;

    expect(essay?.drafts.map((draft) => draft.text)).toStrictEqual(["Second draft", "First draft"]);
    expect(essay?.gradesLeft).toBe(4);

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));

    await expect(getEssay({ blockId })).resolves.toMatchObject({
      essay: { drafts: [{ text: "Second draft" }, { text: "First draft" }], gradesLeft: 6 },
    });
  });
});
