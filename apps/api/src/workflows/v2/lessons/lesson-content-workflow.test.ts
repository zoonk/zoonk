import { randomUUID } from "node:crypto";
import { generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { generateLessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec";
import { keepTeachingPictures } from "@zoonk/ai/tasks/v2/lesson-spec/picture-need";
import { writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { ensureQuickLessons } from "@zoonk/core/library/quick-lessons";
import {
  admitPlanLessons,
  createPlanGenerationManifest,
} from "@zoonk/core/lookahead/speculative-lessons";
import { prisma } from "@zoonk/db";
import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { buildPlan } from "../../../../../../packages/core/src/plans/planner/build-plan";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { recordedLessonFixture } from "../_test-utils/recorded-lesson";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { lessonImagesWorkflow } from "../images/lesson-images-workflow";
import { lessonCheckWorkflow } from "../quality/lesson-check-workflow";
import { lessonContentWorkflow } from "./lesson-content-workflow";
import { writeLessonContentStep } from "./steps/write-lesson-content-step";

// The child admission guard calls through the real producer if anything still reaches it.
vi.mock("../../../../../../packages/core/src/plans/planner/build-plan", { spy: true });

type RecordedSpec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];
type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const recordedSpec = recordedOutput<RecordedSpec>("lesson-spec");
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

async function outlinedLesson(attrs: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const chapter = await libraryChapterFixture({ title: "How vaccines train the immune system" });

  const lesson = await recordedLessonFixture({
    homeChapterId: chapter.id,
    level: "overview",
    ...attrs,
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });

  return lesson;
}

async function plannedLesson() {
  const [lesson, user] = await Promise.all([outlinedLesson(), userFixture()]);
  const goal = await goalFixture({ userId: user.id });
  // An outline can have todo lessons before the initial full plan is ready.
  const plan = await planFixture({ goalId: goal.id, phases: [] });
  const item = await planItemFixture({ lessonId: lesson.id, planId: plan.id });
  return { goal, item, lesson };
}

function runOwner({ active }: { active: boolean }) {
  vi.mocked(getRun).mockReturnValue({
    exists: Promise.resolve(true),
    status: Promise.resolve(active ? "running" : "failed"),
  } as unknown as ReturnType<typeof getRun>);
}

describe(lessonContentWorkflow, () => {
  // Model calls replay a real spec and draft recorded for the same lesson. The picture check keeps
  // every planned picture, as the recorded spec planned.
  beforeEach(() => {
    vi.mocked(generateLessonSpec).mockResolvedValue(taskResult(recordedSpec));
    vi.mocked(keepTeachingPictures).mockImplementation(async ({ spec }) => spec);
    vi.mocked(writeLessonDraft).mockResolvedValue(taskResult(recordedDraft));

    vi.mocked(checkLessonQuality).mockResolvedValue(
      taskResult({ issues: [] }, "anthropic/claude-opus-5.5"),
    );
  });

  it("checks a parent's stale placement manifest before taking any generation claim", async () => {
    const { goal, item, lesson } = await plannedLesson();

    const planManifest = await createPlanGenerationManifest({
      goalId: goal.id,
      lessonIds: [lesson.id],
    });

    expect(planManifest?.targets.map((target) => target.lessonId)).toStrictEqual([lesson.id]);
    await prisma.planItem.update({ data: { status: "testedOut" }, where: { id: item.id } });
    vi.mocked(buildPlan).mockClear();

    await expect(
      lessonContentWorkflow({ lessonId: lesson.id, planGoalId: goal.id, planManifest }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "missing" });

    expect(buildPlan).not.toHaveBeenCalled();
    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).not.toHaveBeenCalled();
    expect(createHook).not.toHaveBeenCalled();
  });

  it.each(["done", "testedOut", "skipped", "paused", "deleted"] as const)(
    "does not claim or generate a lesson made obsolete by %s before the run starts",
    async (change) => {
      const { goal, item, lesson } = await plannedLesson();

      const planManifest = await createPlanGenerationManifest({
        goalId: goal.id,
        lessonIds: [lesson.id],
      });

      const pick = { goalId: goal.id, lessonIds: [lesson.id], manifest: planManifest };
      await expect(admitPlanLessons(pick)).resolves.toStrictEqual([lesson.id]);
      const before = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

      if (change === "paused") {
        await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });
      } else if (change === "deleted") {
        await prisma.goal.delete({ where: { id: goal.id } });
      } else {
        await prisma.planItem.update({ data: { status: change }, where: { id: item.id } });
      }

      await expect(
        lessonContentWorkflow({
          analytics: { goalId: goal.id },
          lessonId: lesson.id,
          planGoalId: goal.id,
          planManifest,
        }),
      ).resolves.toStrictEqual({ lessonId: lesson.id, status: "missing" });

      expect(generateLessonSpec).not.toHaveBeenCalled();
      expect(writeLessonDraft).not.toHaveBeenCalled();
      expect(createHook).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(getStreamedEvents()).toStrictEqual([]);

      await expect(
        prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
      ).resolves.toStrictEqual(before);
    },
  );

  it("writes an on-demand Library lesson outside the active goal used for cost attribution", async () => {
    const { goal } = await plannedLesson();
    const lesson = await outlinedLesson();

    await expect(
      admitPlanLessons({
        goalId: goal.id,
        lessonIds: [lesson.id],
        manifest: await createPlanGenerationManifest({ goalId: goal.id, lessonIds: [lesson.id] }),
      }),
    ).resolves.toStrictEqual([]);

    await expect(
      lessonContentWorkflow({
        analytics: { distinctId: goal.userId, goalId: goal.id },
        lessonId: lesson.id,
      }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(generateLessonSpec).toHaveBeenCalledOnce();
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("writes a lesson its goal still has to do when the queued run starts", async () => {
    const { goal, lesson } = await plannedLesson();

    const planManifest = await createPlanGenerationManifest({
      goalId: goal.id,
      lessonIds: [lesson.id],
    });

    await expect(
      lessonContentWorkflow({
        analytics: { goalId: goal.id },
        lessonId: lesson.id,
        planGoalId: goal.id,
        planManifest,
      }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(generateLessonSpec).toHaveBeenCalledOnce();
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("plans and writes a lesson, streams its progress and starts its pictures and model checks in the background", async () => {
    const lesson = await outlinedLesson();

    // An exam's lesson always gets the reasoning check (after publishing).
    await expect(
      lessonContentWorkflow({
        analytics: { distinctId: "learner" },
        forExam: true,
        lessonId: lesson.id,
      }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    const stored = await prisma.lesson.findUniqueOrThrow({
      include: { skills: true, steps: true },
      where: { id: lesson.id },
    });

    expect(stored).toMatchObject({
      canDo: recordedSpec.lessons[0]?.canDo,
      contentStatus: "completed",
      specStatus: "completed",
    });

    expect(stored.steps).toHaveLength(recordedDraft.screens.length);

    const [link] = stored.skills;

    const questions = stored.steps.filter(
      (step) => step.kind === "check" || step.kind === "typedAnswer",
    );

    expect(link).toBeDefined();
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.map((step) => step.skillId)).toStrictEqual(questions.map(() => link?.skillId));

    expect(
      getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`),
    ).toStrictEqual([
      "planLesson:started",
      "planLesson:completed",
      "writeLesson:started",
      "writeLesson:completed",
      "lessonReady:completed",
    ]);

    expect(start).toHaveBeenCalledWith(lessonImagesWorkflow, [
      { analytics: { contentScope: "shared", distinctId: "learner" }, lessonId: lesson.id },
    ]);

    // The reviewer reads the published lesson in the background: the learner never waits on it.
    expect(checkLessonQuality).not.toHaveBeenCalled();

    expect(start).toHaveBeenCalledWith(lessonCheckWorkflow, [
      {
        analytics: { distinctId: "learner" },
        forExam: true,
        lessonId: lesson.id,
        plan: expect.objectContaining({ lesson: recordedDraft, review: true, version: 1 }),
      },
    ]);
  });

  it("plans a skill's quick lesson as a quick one, on its own, and writes it like any lesson", async () => {
    const [chapter, skill] = await Promise.all([
      libraryChapterFixture({ title: "Biomoléculas" }),
      skillFixture({ name: "Relacionar estrutura proteica e função" }),
    ]);

    const sibling = await libraryLessonFixture({ homeChapterId: chapter.id });

    await Promise.all([
      chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: sibling.id }),
    ]);

    const quickLessons = await ensureQuickLessons({ skillIds: [skill.id] });
    const lessonId = quickLessons.get(skill.id)?.lessonId ?? "";
    vi.mocked(generateLessonSpec).mockClear();

    await expect(lessonContentWorkflow({ lessonId })).resolves.toStrictEqual({
      lessonId,
      status: "ready",
    });

    expect(generateLessonSpec).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        chapterLessons: [],
        quick: true,
        skills: ["Relacionar estrutura proteica e função"],
      }),
    );

    const stored = await prisma.lesson.findUniqueOrThrow({
      include: { chapters: true, steps: true },
      where: { id: lessonId },
    });

    expect(stored).toMatchObject({ chapters: [], contentStatus: "completed" });
    expect(stored.steps).toHaveLength(recordedDraft.screens.length);
  });

  it("reports the lesson published when its write step runs again after publishing it, without writing it again", async () => {
    const lesson = await outlinedLesson();
    await lessonContentWorkflow({ lessonId: lesson.id });
    vi.mocked(writeLessonDraft).mockClear();

    // The runtime runs a step's body again when its result was lost after the body ended (an
    // invocation that timed out, a stream write that failed): the lesson is this run's already.
    await expect(
      writeLessonContentStep({ lessonId: lesson.id, workflowRunId: "test-run-id" }),
    ).resolves.toStrictEqual({ check: null, imageScope: "shared", status: "published" });

    expect(writeLessonDraft).not.toHaveBeenCalled();
  });

  it("plans and writes a lesson a learner reaches soon at the standard tier, and one for a later day at the flex tier", async () => {
    const [soon, later] = await Promise.all([outlinedLesson(), outlinedLesson()]);
    vi.mocked(generateLessonSpec).mockClear();
    vi.mocked(writeLessonDraft).mockClear();

    await lessonContentWorkflow({ lessonId: soon.id });
    await lessonContentWorkflow({ lessonId: later.id, wait: "later" });

    expect(
      vi.mocked(generateLessonSpec).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual([undefined, "flex"]);

    expect(
      vi.mocked(writeLessonDraft).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual([undefined, "flex"]);
  });

  it("pays for priority only when a learner waits on an exam's shared lesson, not on any shared one", async () => {
    const [anyTopic, exam] = await Promise.all([outlinedLesson(), outlinedLesson()]);
    vi.mocked(writeLessonDraft).mockClear();

    await lessonContentWorkflow({ lessonId: anyTopic.id, wait: "learner" });
    await lessonContentWorkflow({ forExam: true, lessonId: exam.id, wait: "learner" });

    expect(
      vi.mocked(writeLessonDraft).mock.calls.map(([params]) => params.serviceTier),
    ).toStrictEqual([undefined, "priority"]);
  });

  it("joins the run already writing the lesson and ends with its result", async () => {
    const lesson = await outlinedLesson();

    vi.mocked(getRun).mockImplementation(
      () => ({ exists: Promise.resolve(true), status: Promise.resolve("completed") }) as never,
    );

    mockHookConflict({
      returnValue: Promise.resolve({ lessonId: lesson.id, status: "ready" }),
      runId: "owner-run",
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "owner-run", status: "started", step: "joinRunningLesson" },
      { entityId: lesson.id, status: "completed", step: "lessonReady" },
    ]);
  });

  it("answers at once for a lesson already written", async () => {
    const lesson = await outlinedLesson({ contentStatus: "completed" });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(writeLessonDraft).not.toHaveBeenCalled();
  });

  it("takes over a lesson whose claim a stopped run left, reusing the spec already written", async () => {
    const lesson = await outlinedLesson({
      contentRunId: "stopped-run",
      contentStatus: "running",
      spec: recordedSpec.lessons[0],
      specStatus: "completed",
    });

    runOwner({ active: false });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("waits for a live run outside the lesson's hook, such as an explanation saving it", async () => {
    const lesson = await outlinedLesson({ contentRunId: "other-run", contentStatus: "running" });
    runOwner({ active: true });

    vi.mocked(sleep).mockImplementation(async () => {
      await prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: lesson.id },
      });
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(writeLessonDraft).not.toHaveBeenCalled();
  });

  it("waits for a live run planning the lesson's spec, then writes the lesson from that spec", async () => {
    const lesson = await outlinedLesson({ specRunId: "other-run", specStatus: "running" });
    runOwner({ active: true });

    vi.mocked(sleep).mockImplementation(async () => {
      await prisma.lesson.update({
        data: { spec: recordedSpec.lessons[0], specStatus: "completed" },
        where: { id: lesson.id },
      });
    });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("frees the lesson for the next run when writing fails, and counts the failure", async () => {
    const lesson = await outlinedLesson();
    vi.mocked(writeLessonDraft).mockRejectedValue(new Error("Provider unavailable"));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed", specStatus: "completed" });

    // A rewrite no learner asked for (a later check or a changed source) counts under the system.
    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "lesson", model: null, task: "lesson-content" },
    });

    // A learner waiting on it hears it failed, so their screen offers to try again.
    expect(getStreamedEvents().at(-1)).toMatchObject({
      reason: "aiGenerationFailed",
      status: "error",
      step: "workflowError",
    });
  });

  it("tells the waiting screens the lesson is ready before its pictures start", async () => {
    const lesson = await outlinedLesson();
    const readyWhenPicturesStart: boolean[] = [];

    vi.mocked(start).mockImplementationOnce(async () => {
      readyWhenPicturesStart.push(
        getStreamedEvents().some((event) => event.step === "lessonReady"),
      );

      return { runId: "pictures-run" } as Awaited<ReturnType<typeof start>>;
    });

    await lessonContentWorkflow({ lessonId: lesson.id });

    expect(readyWhenPicturesStart).toStrictEqual([true]);
  });

  it("gives a lesson made for one learner its pictures, counted as theirs", async () => {
    const user = await userFixture();
    const lesson = await outlinedLesson({ ownerId: user.id, visibility: "private" });

    await expect(
      lessonContentWorkflow({ analytics: { distinctId: user.id }, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(start).toHaveBeenCalledWith(lessonImagesWorkflow, [
      { analytics: { contentScope: "personal", distinctId: user.id }, lessonId: lesson.id },
    ]);

    // Luna plans it, the shared writer writes it, and no reviewer reads it: only reusable lessons
    // get model checks.
    expect(vi.mocked(generateLessonSpec).mock.calls[0]?.[0].model).toBe("openai/gpt-6-luna");
    expect(vi.mocked(writeLessonDraft).mock.calls[0]?.[0].model).toBeUndefined();
    expect(start).not.toHaveBeenCalledWith(lessonCheckWorkflow, expect.anything());
  });

  it("draws no pictures for a guest's own lesson", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });
    const lesson = await outlinedLesson({ ownerId: guest.id, visibility: "private" });

    await expect(
      lessonContentWorkflow({ analytics: { distinctId: guest.id }, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ lessonId: lesson.id, status: "ready" });

    expect(start).not.toHaveBeenCalledWith(lessonImagesWorkflow, expect.anything());
  });

  it("frees both of the lesson's claims when planning it fails", async () => {
    const lesson = await outlinedLesson();
    vi.mocked(generateLessonSpec).mockRejectedValue(new Error("Provider unavailable"));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed", specStatus: "failed" });

    expect(writeLessonDraft).not.toHaveBeenCalled();

    expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
      name: "Generation Failed",
      properties: { content_kind: "lesson", model: null, task: "lesson-content" },
    });
  });

  it("writes a chapter's challenge with the case writer, without a spec step or pictures", async () => {
    const chapter = await libraryChapterFixture();

    // Chapter challenges are cases, so they legitimately have no notebook skill links.
    const lesson = await libraryLessonFixture({
      homeChapterId: chapter.id,
      spec: {
        kind: "challenge",
        skills: [{ description: null, name: "Judge whether a gap is chance" }],
        variant: "work",
      },
      specStatus: "completed",
    });

    vi.mocked(generateChallengeCase).mockResolvedValue(taskResult(writtenChallengeCaseFixture()));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      status: "ready",
    });

    await expect(
      prisma.step.findMany({ select: { kind: true }, where: { lessonId: lesson.id } }),
    ).resolves.toStrictEqual([{ kind: "challenge" }]);

    await expect(prisma.lessonSkill.count({ where: { lessonId: lesson.id } })).resolves.toBe(0);

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(writeLessonDraft).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("reports a lesson that no longer exists", async () => {
    const lessonId = randomUUID();

    await expect(lessonContentWorkflow({ lessonId })).resolves.toStrictEqual({
      lessonId,
      status: "missing",
    });

    expect(getStreamedEvents()).toStrictEqual([
      {
        entityId: lessonId,
        reason: "contentValidationFailed",
        status: "error",
        step: "workflowError",
      },
    ]);
  });
});
