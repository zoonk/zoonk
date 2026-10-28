import { setTimeout as wait } from "node:timers/promises";
import { gradeEssay } from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { prisma } from "@zoonk/db";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getTodayStudySession } from "../../sessions/_test-utils/open-today";
import { DAY_MS, SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { finishStudyBlock } from "../../sessions/finish-study-block";
import { startStudyBlock } from "../../sessions/start-study-block";
import { endEssayGradeClaim } from "./_utils/essay-grade-claims";
import { getEssay } from "./get-essay";
import { submitEssay } from "./submit-essay";

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

  return { blockId, otherBlockId, sessionId, user };
}

function holdGrader() {
  const release = Promise.withResolvers<null>();
  const entered = Promise.withResolvers<null>();

  vi.mocked(gradeEssay).mockImplementation(async () => {
    entered.resolve(null);
    await release.promise;
    return { data: GRADE, provenance: null, systemPrompt: "", usage: null, userPrompt: "" };
  });

  return { entered: entered.promise, release: () => release.resolve(null) };
}

async function useGrades({ count, userId }: { count: number; userId: string }) {
  const essay = await prisma.item.findFirstOrThrow({ where: { format: "essay" } });

  const { localDate } = await prisma.studySession.findFirstOrThrow({
    orderBy: { localDate: "desc" },
    where: { userId },
  });

  await prisma.attempt.createMany({
    data: Array.from({ length: count }, () => ({
      answer: {},
      durationMs: 1000,
      hour: 12,
      isCorrect: true,
      itemId: essay.id,
      localDate,
      userId,
      weekday: localDate.getUTCDay(),
    })),
  });

  return localDate;
}

async function recordingGrade({
  attemptId,
  localDate,
  userId,
}: {
  attemptId: string;
  localDate: Date;
  userId: string;
}) {
  const essay = await prisma.item.findFirstOrThrow({ where: { format: "essay" } });
  const holding = Promise.withResolvers<number>();
  const commit = Promise.withResolvers<null>();

  await prisma.essayGradeClaim.create({
    data: { createdAt: new Date(), id: attemptId, localDate, userId },
  });

  const recording = prisma.$transaction(
    async (tx) => {
      const [{ pid }] = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() AS pid`;
      await endEssayGradeClaim(tx, { attemptId, userId });

      await tx.attempt.create({
        data: {
          answer: { grade: GRADE, text: "My essay about it." },
          durationMs: 1000,
          hour: 12,
          id: attemptId,
          isCorrect: true,
          itemId: essay.id,
          localDate,
          userId,
          weekday: localDate.getUTCDay(),
        },
      });

      holding.resolve(pid);
      await commit.promise;
    },
    { timeout: 30_000 },
  );

  const pid = await holding.promise;

  const blocked = vi.waitFor(
    async () => {
      const [{ count }] = await prisma.$queryRaw<[{ count: number }]>`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE ${pid}::int = ANY(pg_blocking_pids(pid))
      `;

      expect(count).toBeGreaterThan(0);
    },
    { interval: 20, timeout: 10_000 },
  );

  return {
    blocked,
    commit: async () => {
      commit.resolve(null);
      await recording;
    },
  };
}

describe("essays in sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);

    vi.mocked(gradeEssay).mockResolvedValue({
      data: GRADE,
      provenance: null,
      systemPrompt: "",
      usage: null,
      userPrompt: "",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(gradeEssay).mockReset();
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
      submitEssay({ blockId, input: { durationMs: 600_000, text: "My essay about it." } }),
    ).resolves.toMatchObject({ grade: { total: { score: 720 } }, status: "graded" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    ).resolves.toMatchObject({ status: "active" });

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

    await expect(
      submitEssay({ blockId, input: { durationMs: 1000, text: "Another draft" } }),
    ).resolves.toStrictEqual({ status: "blockNotActive" });
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
    const { goal, user } = await essaySetup();
    const today = await getTodayStudySession({ goalId: goal.id });
    const session = today.status === "ready" ? today.session : null;
    const blockId = session?.blocks.find((block) => block.kind === "produce")?.id ?? "";
    const sessionId = session?.id ?? "";

    await startStudyBlock({ blockId, input: {}, sessionId });

    const [{ localDate }, essay] = await Promise.all([
      prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
      prisma.item.findFirstOrThrow({
        where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
      }),
    ]);

    await prisma.attempt.createMany({
      data: Array.from({ length: 6 }, () => ({
        answer: {},
        durationMs: 1000,
        hour: 12,
        isCorrect: true,
        itemId: essay.id,
        localDate,
        userId: user.id,
        weekday: localDate.getUTCDay(),
      })),
    });

    await expect(
      submitEssay({ blockId, input: { durationMs: 1000, text: "One more" } }),
    ).resolves.toStrictEqual({ status: "limitReached" });

    expect(gradeEssay).not.toHaveBeenCalled();
  });
});

describe("essay drafts and access", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);

    vi.mocked(gradeEssay).mockResolvedValue({
      data: GRADE,
      provenance: null,
      systemPrompt: "",
      usage: null,
      userPrompt: "",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(gradeEssay).mockReset();
  });

  it("grades and records a draft sent again with its id once", async () => {
    const { blockId, user } = await startedWritingBlock();
    const input = { attemptId: crypto.randomUUID(), durationMs: 1000, text: "My essay about it." };

    const first = await submitEssay({ blockId, input });
    const again = await submitEssay({ blockId, input });

    expect(first).toMatchObject({ grade: { total: { score: 720 } }, status: "graded" });
    expect(again).toStrictEqual(first);
    expect(gradeEssay).toHaveBeenCalledOnce();

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(getEssay({ blockId })).resolves.toMatchObject({ essay: { gradesLeft: 5 } });
  });

  it("grades a draft sent twice at once a single time, and the second request gets its grade", async () => {
    const { blockId, user } = await startedWritingBlock();
    const grader = holdGrader();
    const input = { attemptId: crypto.randomUUID(), durationMs: 1000, text: "My essay about it." };

    const first = submitEssay({ blockId, input });
    await grader.entered;
    const second = submitEssay({ blockId, input });

    await wait(300);
    grader.release();

    const [graded, again] = await Promise.all([first, second]);

    expect(graded).toMatchObject({ grade: { total: { score: 720 } }, status: "graded" });
    expect(again).toStrictEqual(graded);
    expect(gradeEssay).toHaveBeenCalledOnce();
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(getEssay({ blockId })).resolves.toMatchObject({ essay: { gradesLeft: 5 } });
  });

  it("grades drafts sent at once only up to the day's essay grades", async () => {
    const { blockId, user } = await startedWritingBlock();
    await useGrades({ count: 5, userId: user.id });
    const grader = holdGrader();

    const sent = ["My first essay.", "Another essay."].map((text) =>
      submitEssay({ blockId, input: { attemptId: crypto.randomUUID(), durationMs: 1000, text } }),
    );

    await grader.entered;
    await wait(300);
    grader.release();

    const outcomes = await Promise.all(sent);

    expect(outcomes.map((outcome) => outcome.status).toSorted()).toStrictEqual([
      "graded",
      "limitReached",
    ]);

    expect(gradeEssay).toHaveBeenCalledOnce();
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(6);
  });

  it("makes a draft sent again while its grade is being recorded wait for it, then replay it", async () => {
    const { blockId, user } = await startedWritingBlock();
    const key = crypto.randomUUID();
    const localDate = await useGrades({ count: 0, userId: user.id });

    const recording = await recordingGrade({
      attemptId: getAnswerAttemptId({ key, questionId: blockId, userId: user.id }),
      localDate,
      userId: user.id,
    });

    const again = submitEssay({
      blockId,
      input: { attemptId: key, durationMs: 1000, text: "My essay about it." },
    });

    await recording.blocked;
    await recording.commit();

    await expect(again).resolves.toMatchObject({
      grade: { total: { score: 720 } },
      status: "graded",
    });

    expect(gradeEssay).not.toHaveBeenCalled();
  });

  it("makes a draft sent while the day's last grade is being recorded wait, then refuses it", async () => {
    const { blockId, user } = await startedWritingBlock();
    const localDate = await useGrades({ count: 5, userId: user.id });

    const recording = await recordingGrade({
      attemptId: crypto.randomUUID(),
      localDate,
      userId: user.id,
    });

    const other = submitEssay({
      blockId,
      input: { attemptId: crypto.randomUUID(), durationMs: 1000, text: "Another essay." },
    });

    await recording.blocked;
    await recording.commit();

    await expect(other).resolves.toStrictEqual({ status: "limitReached" });
    expect(gradeEssay).not.toHaveBeenCalled();
  });

  it("grades a draft again after its grade failed", async () => {
    const { blockId, user } = await startedWritingBlock();
    const input = { attemptId: crypto.randomUUID(), durationMs: 1000, text: "My essay about it." };

    vi.mocked(gradeEssay).mockRejectedValueOnce(new Error("The grader is down"));

    await expect(submitEssay({ blockId, input })).rejects.toThrow("The grader is down");

    await expect(submitEssay({ blockId, input })).resolves.toMatchObject({ status: "graded" });
    expect(gradeEssay).toHaveBeenCalledTimes(2);
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
    await expect(prisma.essayGradeClaim.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("grades a draft whose earlier request crashed mid-grade once that claim expired", async () => {
    const { blockId, user } = await startedWritingBlock();
    const key = crypto.randomUUID();
    const localDate = await useGrades({ count: 0, userId: user.id });

    await prisma.essayGradeClaim.create({
      data: {
        createdAt: new Date(Date.now() - 400_000),
        id: getAnswerAttemptId({ key, questionId: blockId, userId: user.id }),
        localDate,
        userId: user.id,
      },
    });

    await expect(
      submitEssay({ blockId, input: { attemptId: key, durationMs: 1000, text: "My essay." } }),
    ).resolves.toMatchObject({ status: "graded" });

    expect(gradeEssay).toHaveBeenCalledOnce();
    await expect(prisma.essayGradeClaim.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("holds no lock or transaction while the model grades, only the draft's claim", async () => {
    const { blockId, user } = await startedWritingBlock();

    vi.mocked(gradeEssay).mockImplementationOnce(async () => {
      const [{ claims, locks }] = await prisma.$queryRaw<[{ claims: number; locks: number }]>`
        SELECT
          (SELECT count(*)::int FROM essay_grade_claims WHERE user_id = ${user.id}::uuid) AS claims,
          (SELECT count(*)::int FROM pg_locks
            WHERE locktype = 'advisory' AND classid = 51883
              AND objid = (hashtext(${user.id})::bigint & 4294967295)::oid) AS locks
      `;

      expect({ claims, locks }).toStrictEqual({ claims: 1, locks: 0 });
      return { data: GRADE, provenance: null, systemPrompt: "", usage: null, userPrompt: "" };
    });

    await expect(
      submitEssay({ blockId, input: { durationMs: 1000, text: "My essay about it." } }),
    ).resolves.toMatchObject({ status: "graded" });

    expect(gradeEssay).toHaveBeenCalledOnce();
  });

  it("doesn't record a rewrite graded while the learner skipped it and the block was settled", async () => {
    const { blockId, sessionId, user } = await startedWritingBlock();

    await submitEssay({ blockId, input: { durationMs: 1000, text: "My essay about it." } });

    vi.mocked(gradeEssay).mockImplementationOnce(async () => {
      await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toMatchObject({
        status: "ready",
      });

      return { data: GRADE, provenance: null, systemPrompt: "", usage: null, userPrompt: "" };
    });

    await expect(
      submitEssay({ blockId, input: { durationMs: 1000, text: "My rewrite about it." } }),
    ).resolves.toStrictEqual({ status: "blockNotActive" });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("starts today's writing block when a draft is sent, but never another day's", async () => {
    const { goal } = await essaySetup();
    const today = await getTodayStudySession({ goalId: goal.id });
    const blocks = today.status === "ready" ? today.session.blocks : [];
    const sessionId = today.status === "ready" ? today.session.id : "";
    const blockId = blocks.find((block) => block.kind === "produce")?.id ?? "";
    const input = { durationMs: 1000, text: "Draft" };

    const { localDate } = await prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } });
    const yesterday = new Date(localDate.getTime() - DAY_MS);

    await prisma.studySession.update({ data: { localDate: yesterday }, where: { id: sessionId } });

    await expect(submitEssay({ blockId, input })).resolves.toStrictEqual({
      status: "blockNotActive",
    });

    expect(gradeEssay).not.toHaveBeenCalled();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });

    await prisma.studySession.update({ data: { localDate }, where: { id: sessionId } });

    await expect(submitEssay({ blockId, input })).resolves.toMatchObject({ status: "graded" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    ).resolves.toMatchObject({ status: "active" });
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

async function writesToday({
  cadence,
  startDate,
  targetDate,
}: {
  cadence: string;
  startDate: string;
  targetDate: string;
}) {
  const { goal, plan } = await essaySetup();

  await Promise.all([
    dailyProgressFixtureMany([
      { date: new Date("2026-09-29T00:00:00Z"), timeSpentSeconds: 600, userId: goal.userId },
    ]),
    prisma.goal.update({
      data: { targetDate: new Date(`${targetDate}T00:00:00Z`) },
      where: { id: goal.id },
    }),
    prisma.plan.update({
      data: { settings: { startDate, writtenCadence: cadence } },
      where: { id: plan.id },
    }),
  ]);

  const today = await getTodayStudySession({ goalId: goal.id });
  return today.status === "ready" && today.session.blocks.some((block) => block.kind === "produce");
}

describe("essays on the learner's written cadence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes in the plan's first, third… week when the learner practices every other week", async () => {
    await expect(
      writesToday({ cadence: "biweekly", startDate: "2026-09-30", targetDate: "2026-12-20" }),
    ).resolves.toBe(true);

    await expect(
      writesToday({ cadence: "biweekly", startDate: "2026-09-23", targetDate: "2026-12-20" }),
    ).resolves.toBe(false);
  });

  it("writes only in the final weeks before the exam when the learner asked for that", async () => {
    await expect(
      writesToday({ cadence: "finalWeeks", startDate: "2026-09-01", targetDate: "2026-10-20" }),
    ).resolves.toBe(true);

    await expect(
      writesToday({ cadence: "finalWeeks", startDate: "2026-09-01", targetDate: "2026-11-30" }),
    ).resolves.toBe(false);
  });
});
