import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { citeMaterial } from "@zoonk/ai/tasks/v2/material/cite";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { holdLearnerLock, waitForBlockedStatement } from "../../_test-utils/learner-lock";
import * as refresh from "../../plans/refresh-goal-plan";
import { writeLessonContent } from "../lessons/write-lesson-content";
import { PAGE_BREAK, PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE } from "../sources/source-contract";
import { temperatureSpec, writtenTemperatureLesson } from "./_test-utils/written-lessons";
import {
  checkPublishedLesson,
  citePublishedLesson,
  redraftPublishedLesson,
  setAsidePublishedLesson,
} from "./published-lesson-check";

type ReviewIssue = Awaited<ReturnType<typeof checkLessonQuality>>["data"]["issues"][number];

function provenance(model = "openai/gpt-6-sol") {
  return {
    generatedAt: new Date().toISOString(),
    latencyMs: 1,
    model,
    promptVersion: "test-prompt",
    provider: "test",
    requestedModel: model,
    runId: randomUUID(),
    usage: {},
  };
}

function mockDraft(lesson: WrittenLesson) {
  const draftProvenance = provenance();

  vi.mocked(writeLessonDraft).mockResolvedValueOnce({
    data: lesson,
    provenance: draftProvenance,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  return draftProvenance;
}

function mockFix({ changedScreens, lesson }: { changedScreens: number[]; lesson: WrittenLesson }) {
  const fixProvenance = provenance();

  vi.mocked(fixLessonDraft).mockResolvedValueOnce({
    data: { changedScreens, lesson },
    provenance: fixProvenance,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  return fixProvenance;
}

function mockReview(issues: ReviewIssue[] = []) {
  vi.mocked(checkLessonQuality).mockResolvedValueOnce({
    data: { issues },
    provenance: provenance("anthropic/claude-sonnet-5.5"),
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function withScreen(lesson: WrittenLesson, index: number, screen: WrittenScreen): WrittenLesson {
  return {
    ...lesson,
    screens: lesson.screens.map((current, at) => (at === index ? screen : current)),
  };
}

function explanation(text: string): WrittenScreen {
  return {
    exampleLineIdea: null,
    explore: null,
    image: null,
    kind: "explanation",
    text,
    title: "Up is up",
    visual: null,
  };
}

const wrongRise: ReviewIssue = {
  fix: "Say that a rise moves up the thermometer.",
  kind: "incorrect",
  problem: "The screen says a rise moves the mark down below zero.",
  screen: 4,
  severity: "blocking",
};

const writtenWrong = () =>
  withScreen(writtenTemperatureLesson(), 4, explanation("A rise moves the mark down below zero."));

const writtenRight = () =>
  withScreen(
    writtenTemperatureLesson(),
    4,
    explanation("A rise moves the mark up, even below zero."),
  );

/** A lesson published through the real write path (its code checks passed), with its check plan. */
async function publishLesson({
  lesson: written = writtenTemperatureLesson(),
  ownerId = null,
  prepare,
}: {
  lesson?: WrittenLesson;
  ownerId?: string | null;
  /** Links material or sources before writing. */
  prepare?: (lessonId: string) => Promise<unknown>;
} = {}) {
  const workflowRunId = randomUUID();
  const skill = await skillFixture({ name: "Add a rise to a temperature below zero" });

  const lesson = await libraryLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    spec: temperatureSpec(),
    specStatus: "completed",
    ...(ownerId ? { ownerId, visibility: "private" as const } : {}),
  });

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    prepare?.(lesson.id),
  ]);

  const draft = mockDraft(written);
  const result = await writeLessonContent({ lessonId: lesson.id, workflowRunId });

  if (result.status !== "published") {
    throw new Error(`The test lesson wasn't published: ${result.status}`);
  }

  return { draft, lesson, plan: result.check };
}

function listSteps(lessonId: string) {
  return prisma.step.findMany({
    orderBy: [{ version: "asc" }, { position: "asc" }],
    where: { lessonId },
  });
}

describe(checkPublishedLesson, () => {
  it("leaves a version the reviewer passes as it is, reviewing it at flex", async () => {
    const { draft, lesson, plan } = await publishLesson();
    mockReview();

    await expect(
      checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "passed" });

    expect(checkLessonQuality).toHaveBeenCalledWith(
      expect.objectContaining({ serviceTier: "flex", writerModel: draft.model }),
    );

    const steps = await listSteps(lesson.id);
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });

  it("publishes the fix of what the reviewer found as the next version, keeping the one learners opened", async () => {
    const { draft, lesson, plan } = await publishLesson({ lesson: writtenWrong() });
    mockReview([wrongRise]);
    const fix = mockFix({ changedScreens: [4], lesson: writtenRight() });

    await expect(
      checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "republished", version: 2 });

    // The fix only rewrote the flagged screen: the code checks ran again, the reviewer didn't.
    expect(checkLessonQuality).toHaveBeenCalledOnce();
    expect(fixLessonDraft).toHaveBeenCalledWith(expect.objectContaining({ serviceTier: "flex" }));

    const [steps, stored] = await Promise.all([
      listSteps(lesson.id),
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ]);

    const opened = steps.filter((step) => step.version === 1);
    const fixed = steps.filter((step) => step.version === 2);

    // The version learners opened stays (retired) for them to finish; the next open gets the fix.
    expect(stored.contentStatus).toBe("completed");
    expect(opened).toHaveLength(8);
    expect(opened.every((step) => step.retiredAt !== null)).toBe(true);
    expect(fixed.every((step) => step.retiredAt === null)).toBe(true);

    expect(fixed.map((step) => step.runId)).toStrictEqual(
      fixed.map((step) => (step.position === 4 ? fix.runId : draft.runId)),
    );

    expect(fixed[4]?.content).toMatchObject({ text: "A rise moves the mark up, even below zero." });
    expect(opened[4]?.content).toMatchObject({ text: "A rise moves the mark down below zero." });
  });

  it("reads a fix again when it strayed from what was flagged, and holds back what's still wrong", async () => {
    const { lesson, plan } = await publishLesson({ lesson: writtenWrong() });
    mockReview([wrongRise]);

    const strayed = withScreen(
      writtenRight(),
      1,
      explanation("Zero is the mark where water freezes, and the rise stops there."),
    );

    mockFix({ changedScreens: [1, 4], lesson: strayed });
    mockReview([{ ...wrongRise, problem: "The screen says the rise stops at zero.", screen: 1 }]);

    await expect(
      checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() }),
    ).resolves.toMatchObject({
      draft: { problems: [expect.objectContaining({ screen: 1 })] },
      incorrect: true,
      status: "heldBack",
    });

    expect(checkLessonQuality).toHaveBeenCalledTimes(2);

    const steps = await listSteps(lesson.id);
    expect(steps.every((step) => step.version === 1 && step.retiredAt === null)).toBe(true);
  });

  it("holds back a version whose fix left the screen the reviewer found wrong as it was", async () => {
    const { lesson, plan } = await publishLesson({ lesson: writtenWrong() });
    mockReview([wrongRise]);
    mockFix({ changedScreens: [], lesson: writtenWrong() });

    await expect(
      checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() }),
    ).resolves.toMatchObject({ incorrect: true, status: "heldBack" });
  });

  it("changes nothing when another version took the lesson's place meanwhile", async () => {
    const { lesson, plan } = await publishLesson({ lesson: writtenWrong() });
    mockReview([wrongRise]);
    mockFix({ changedScreens: [4], lesson: writtenRight() });
    await checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() });

    // A second check of the version that was just replaced reads nothing and writes nothing.
    await expect(
      checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "replaced" });

    expect(checkLessonQuality).toHaveBeenCalledOnce();
  });

  it("keeps the pictures the replaced version had for screens asking for the same picture", async () => {
    const { lesson, plan } = await publishLesson({ lesson: writtenWrong() });
    const picture = await mediaAssetFixture();

    await prisma.step.updateMany({
      data: { mediaAssetId: picture.id },
      where: { lessonId: lesson.id, position: 1 },
    });

    mockReview([wrongRise]);
    mockFix({ changedScreens: [4], lesson: writtenRight() });
    await checkPublishedLesson({ lessonId: lesson.id, plan, workflowRunId: randomUUID() });

    const current = await prisma.step.findFirstOrThrow({
      where: { lessonId: lesson.id, position: 1, retiredAt: null },
    });

    expect(current).toMatchObject({ mediaAssetId: picture.id, version: 2 });
  });
});

describe(redraftPublishedLesson, () => {
  it("replaces a version no fix put right with a fresh draft, told what held the first back", async () => {
    const { lesson, plan } = await publishLesson({ lesson: writtenWrong() });

    const heldBack = {
      heldBackAt: new Date().toISOString(),
      model: plan.writerModel,
      problems: [{ problem: "The rise goes down.", screen: 4 }],
      runId: randomUUID(),
    };

    const redraft = mockDraft(writtenRight());
    mockReview();

    await expect(
      redraftPublishedLesson({
        heldBackDrafts: [heldBack],
        lessonId: lesson.id,
        version: plan.version,
        workflowRunId: randomUUID(),
      }),
    ).resolves.toStrictEqual({ status: "republished", version: 2 });

    // Nobody waits on it: the draft is reviewed before it's published, all at flex.
    expect(writeLessonDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ heldBackProblems: heldBack.problems, serviceTier: "flex" }),
    );

    expect(checkLessonQuality).toHaveBeenCalledOnce();

    const current = await prisma.step.findMany({ where: { lessonId: lesson.id, retiredAt: null } });
    expect(current.every((step) => step.version === 2 && step.runId === redraft.runId)).toBe(true);
  });
});

describe(citePublishedLesson, () => {
  it("cites the slides each screen of a version written from its owner's material teaches from", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, slides] = await Promise.all([
      planFixture({ goalId: goal.id }),
      sourceFixture({
        extractedText: ["Temperatures", "A rise moves up, even below zero"].join(PAGE_BREAK),
        kind: "upload",
        mimeType: PPTX_CONTENT_TYPE,
        ownerId: user.id,
        title: "Class 3",
        visibility: "private",
      }),
    ]);

    const published = await publishLesson({
      ownerId: user.id,
      prepare: (lessonId) =>
        Promise.all([
          planItemFixture({ lessonId, phase: 0, planId: plan.id, position: 0 }),
          learnerSourceFixture({ goalId: goal.id, sourceId: slides.id, userId: user.id }),
        ]),
    });

    vi.mocked(citeMaterial).mockResolvedValueOnce({
      data: {
        citations: [
          { ref: null, screen: 1 },
          { ref: "S1:2", screen: 2 },
          { ref: "S1:9", screen: 3 },
        ],
      },
      provenance: provenance("openai/gpt-6-luna"),
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    await expect(
      citePublishedLesson({
        lessonId: published.lesson.id,
        plan: published.plan,
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe(1);

    expect(citeMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ documents: "material", serviceTier: "flex" }),
    );

    const steps = await listSteps(published.lesson.id);

    // A reference to a slide the lesson wasn't given is dropped.
    expect(steps.slice(0, 3).map((step) => [step.sourceId, step.sourcePage])).toStrictEqual([
      [null, null],
      [slides.id, 2],
      [null, null],
    ]);
  });

  it("cites a shared lesson from the public sources its facts come from as official documents", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, guidance] = await Promise.all([
      planFixture({ goalId: goal.id }),
      sourceFixture({
        extractedText: [
          "Agency history and contact details.",
          "A forecast rise adds to the temperature, even below zero: from −3 °C, a rise of 5 degrees reads 2 °C on the thermometer.",
        ].join(PAGE_BREAK),
        mimeType: PDF_CONTENT_TYPE,
        publisher: "National Weather Service",
        title: "Reading temperature forecasts",
      }),
    ]);

    const published = await publishLesson({
      prepare: (lessonId) =>
        Promise.all([
          planItemFixture({ lessonId, phase: 0, planId: plan.id, position: 0 }),
          learnerSourceFixture({
            goalId: goal.id,
            origin: "research",
            sourceId: guidance.id,
            userId: user.id,
          }),
        ]),
    });

    vi.mocked(citeMaterial).mockResolvedValueOnce({
      data: { citations: [{ ref: null, screen: 1 }] },
      provenance: provenance("openai/gpt-6-luna"),
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    await citePublishedLesson({
      lessonId: published.lesson.id,
      plan: published.plan,
      workflowRunId: randomUUID(),
    });

    expect(citeMaterial).toHaveBeenLastCalledWith(
      expect.objectContaining({ documents: "sources", serviceTier: "flex" }),
    );
  });

  it("throws when the citing call fails, so the workflow step citing the version retries it", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, slides] = await Promise.all([
      planFixture({ goalId: goal.id }),
      sourceFixture({
        extractedText: ["Temperatures", "A rise moves up, even below zero"].join(PAGE_BREAK),
        kind: "upload",
        mimeType: PPTX_CONTENT_TYPE,
        ownerId: user.id,
        title: "Class 3",
        visibility: "private",
      }),
    ]);

    const published = await publishLesson({
      ownerId: user.id,
      prepare: (lessonId) =>
        Promise.all([
          planItemFixture({ lessonId, phase: 0, planId: plan.id, position: 0 }),
          learnerSourceFixture({ goalId: goal.id, sourceId: slides.id, userId: user.id }),
        ]),
    });

    const busy = new Error("The provider is overloaded");
    vi.mocked(citeMaterial).mockRejectedValueOnce(busy);

    await expect(
      citePublishedLesson({
        lessonId: published.lesson.id,
        plan: published.plan,
        workflowRunId: randomUUID(),
      }),
    ).rejects.toBe(busy);
  });
});

describe(setAsidePublishedLesson, () => {
  it("takes a lesson out of play and moves plans on, while its screens stay for learners playing it", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    const { lesson, plan: check } = await publishLesson();

    const item = await planItemFixture({
      lessonId: lesson.id,
      phase: 0,
      planId: plan.id,
      position: 0,
    });

    await expect(
      setAsidePublishedLesson({ lessonId: lesson.id, version: check.version }),
    ).resolves.toBe(true);

    const [stored, planItem, steps] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
      listSteps(lesson.id),
    ]);

    expect(stored).toMatchObject({ contentStatus: "failed", setAsideAt: expect.any(Date) });
    expect(planItem.status).toBe("skipped");
    expect(steps.every((step) => step.retiredAt === null)).toBe(true);

    // A version that was replaced meanwhile isn't set aside.
    await expect(setAsidePublishedLesson({ lessonId: lesson.id, version: 7 })).resolves.toBe(false);
  });
});

async function setAsideScope() {
  const [user, other, untouched, lesson, skill] = await Promise.all([
    userFixture(),
    userFixture(),
    userFixture(),
    libraryLessonFixture({ contentStatus: "completed" }),
    skillFixture(),
  ]);

  await Promise.all([
    libraryStepFixture({ lessonId: lesson.id, version: 1 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  const goals = await Promise.all([
    goalFixture({ userId: user.id }),
    goalFixture({ userId: user.id }),
    goalFixture({ userId: other.id }),
    goalFixture({ userId: untouched.id }),
  ]);

  const plans = await Promise.all(
    goals.map((goal) =>
      planFixture({ goalId: goal.id, sourceSkillIds: goal.userId === user.id ? [skill.id] : [] }),
    ),
  );

  const [item] = await Promise.all([
    planItemFixture({ lessonId: lesson.id, planId: plans[0]!.id }),
    planItemFixture({ lessonId: lesson.id, planId: plans[2]!.id }),
  ]);

  return { item: item!, lesson, other, plans, untouched, user };
}

describe("set-aside selection admission", () => {
  it("retries plan refreshes after the published hold-back was already saved", async () => {
    const { lesson } = await setAsideScope();

    const renew = vi
      .spyOn(refresh, "refreshGoalPlan")
      .mockRejectedValueOnce(new Error("Refresh interrupted"));

    try {
      await expect(setAsidePublishedLesson({ lessonId: lesson.id, version: 1 })).rejects.toThrow(
        "Refresh interrupted",
      );

      const calls = renew.mock.calls.length;

      await expect(setAsidePublishedLesson({ lessonId: lesson.id, version: 1 })).resolves.toBe(
        false,
      );

      expect(renew).toHaveBeenCalledTimes(calls * 2);
    } finally {
      renew.mockRestore();
    }
  });

  it("marks dependent plans and each owner once, and leaves rejected and repeated calls unchanged", async () => {
    const { lesson, plans } = await setAsideScope();
    await expect(setAsidePublishedLesson({ lessonId: lesson.id, version: 7 })).resolves.toBe(false);
    await expect(setAsidePublishedLesson({ lessonId: lesson.id, version: 1 })).resolves.toBe(true);

    await Promise.all(
      plans.map((plan) =>
        expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
          inputVersion: plan.inputVersion + Number(plan.id !== plans[3]!.id),
        }),
      ),
    );

    await expect(setAsidePublishedLesson({ lessonId: lesson.id, version: 1 })).resolves.toBe(false);
  });

  it("marks before the lesson lock and rolls back a version that loses while admission waits", async () => {
    const { user, lesson, plans, item } = await setAsideScope();

    const holder = holdLearnerLock({
      beforeCommit: async (tx) => {
        await tx.$queryRaw`SELECT id FROM library_lessons WHERE id = ${lesson.id}::uuid FOR UPDATE`;
        await tx.step.updateMany({ data: { version: 2 }, where: { lessonId: lesson.id } });
      },
      userId: user.id,
    });

    const pid = await holder.pid;
    const pending = setAsidePublishedLesson({ lessonId: lesson.id, version: 1 });

    try {
      await waitForBlockedStatement(pid, /SELECT id FROM users/u);
    } finally {
      holder.release();
      await Promise.all([holder.done, pending]);
    }

    await expect(pending).resolves.toBe(false);

    await Promise.all(
      plans.map((plan) =>
        expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
          inputVersion: plan.inputVersion,
        }),
      ),
    );

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "completed", setAsideAt: null });
  });

  it("commits one selection change for two set-aside requests that race", async () => {
    const { user, lesson, plans } = await setAsideScope();
    const holder = holdLearnerLock({ userId: user.id });
    const pid = await holder.pid;

    const calls = Promise.all([
      setAsidePublishedLesson({ lessonId: lesson.id, version: 1 }),
      setAsidePublishedLesson({ lessonId: lesson.id, version: 1 }),
    ]);

    try {
      await waitForBlockedStatement(pid, /SELECT id FROM users/u);
      await waitForBlockedStatement(pid, /SELECT plan.id, goal.user_id/u);
    } finally {
      holder.release();
      await Promise.all([holder.done, calls]);
    }

    const outcomes = await calls;
    expect(outcomes.toSorted()).toStrictEqual([false, true]);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: plans[0]!.id } }),
    ).resolves.toMatchObject({ inputVersion: plans[0]!.inputVersion + 1 });
  });
});
