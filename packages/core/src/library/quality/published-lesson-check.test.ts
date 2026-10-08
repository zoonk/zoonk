import { randomUUID } from "node:crypto";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { citeMaterial } from "@zoonk/ai/tasks/v2/material/cite";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { writeLessonContent } from "../lessons/write-lesson-content";
import { PAGE_BREAK, PPTX_CONTENT_TYPE } from "../sources/source-contract";
import { temperatureSpec, writtenTemperatureLesson } from "./_test-utils/written-lessons";
import {
  checkPublishedLesson,
  citePublishedLesson,
  redraftPublishedLesson,
  setAsidePublishedLesson,
} from "./published-lesson-check";

/** Model calls are the external boundary; checks, versions and storage run for real. */
vi.mock("@zoonk/ai/tasks/v2/lesson-writer", () => ({
  getLessonRewriteModel: vi.fn(() => "anthropic/claude-sonnet-5.5"),
  writeLessonDraft: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/lesson-writer/fix", () => ({ fixLessonDraft: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/quality/lesson-check", () => ({ checkLessonQuality: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/material/cite", () => ({ citeMaterial: vi.fn() }));

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

    expect(citeMaterial).toHaveBeenCalledWith(expect.objectContaining({ serviceTier: "flex" }));

    const steps = await listSteps(published.lesson.id);

    // A reference to a slide the lesson wasn't given is dropped.
    expect(steps.slice(0, 3).map((step) => [step.sourceId, step.sourcePage])).toStrictEqual([
      [null, null],
      [slides.id, 2],
      [null, null],
    ]);
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
