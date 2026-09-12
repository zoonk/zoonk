import { generateCoursePath } from "@zoonk/ai/tasks/courses/path";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import {
  getCourseLearningPath,
  startCurrentUserCourse,
  updateCurrentUserCoursePlan,
} from "./learning-plan";

vi.mock("@zoonk/ai/tasks/courses/path", () => ({ generateCoursePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function courseTree() {
  const [user, organization] = await Promise.all([
    userFixture(),
    organizationFixture({ kind: "brand" }),
  ]);

  const course = await courseFixture({
    curriculumVersion: 2,
    isPublished: true,
    organizationId: organization.id,
  });

  const chapters = await Promise.all(
    ["overview", "basic", "intermediate", "advanced"].map((level, position) =>
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        level: level as "overview" | "basic" | "intermediate" | "advanced",
        position,
      }),
    ),
  );

  const lessons = await Promise.all(
    chapters.map((chapter) =>
      lessonFixture({ chapterId: chapter.id, generationStatus: "completed", isPublished: true }),
    ),
  );

  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
  return { chapters, course, lessons, user };
}

describe("course learning plans", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

  it("rejects paid model selection when the daily operational budget is exhausted", async () => {
    const { course, user } = await courseTree();
    const now = new Date();

    await prisma.generationQuotaCounter.create({
      data: {
        actorKey: `user:${user.id}`,
        count: 100,
        period: "day",
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        resource: "learningRequest",
      },
    });

    await expect(
      updateCurrentUserCoursePlan({
        courseId: course.id,
        input: { depth: "focused", goal: "A new focused goal" },
      }),
    ).resolves.toMatchObject({
      limit: { period: "day", resource: "learningRequest" },
      status: "limitReached",
    });

    expect(generateCoursePath).not.toHaveBeenCalled();

    await expect(
      prisma.courseLearningPlan.count({ where: { courseId: course.id, userId: user.id } }),
    ).resolves.toBe(0);

    await expect(
      updateCurrentUserCoursePlan({
        courseId: course.id,
        input: { dailyMinutes: 5, depth: "overview" },
      }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("preserves a current focused selection when only pacing or optional formats change", async () => {
    const { course, chapters } = await courseTree();
    const selected = chapters[1];

    if (!selected) {
      throw new Error("Missing selected chapter");
    }

    vi.mocked(generateCoursePath, { partial: true }).mockResolvedValue({
      data: { chapterIds: [selected.id], summary: "Your goal" },
    });

    const input = {
      depth: "focused" as const,
      goal: "Prepare a real prototype",
      startingKnowledge: "Some basics",
    };

    const initial = await updateCurrentUserCoursePlan({ courseId: course.id, input });

    if (initial.status !== "ready") {
      throw new Error("Missing initial plan");
    }

    vi.mocked(generateCoursePath).mockClear();

    const updated = await updateCurrentUserCoursePlan({
      courseId: course.id,
      expectedRevision: initial.plan.revision,
      input: { ...input, dailyMinutes: 5, hiddenLessonKinds: ["quiz"] },
    });

    expect(updated).toMatchObject({
      plan: { chapterIds: [selected.id], dailyMinutes: 5, summary: "Your goal" },
      status: "ready",
    });

    expect(generateCoursePath).not.toHaveBeenCalled();
  });

  it("keeps overview progress when switching to the comprehensive path and excludes optional activities", async () => {
    const { chapters, course, lessons, user } = await courseTree();

    await lessonFixture({
      chapterId: chapters[0]!.id,
      isPublished: true,
      kind: "quiz",
      position: 1,
      sourceLessonId: lessons[0]!.id,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lessons[0]!.id,
      userId: user.id,
    });

    await expect(
      updateCurrentUserCoursePlan({ courseId: course.id, input: { depth: "overview" } }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(getCourseLearningPath({ courseId: course.id })).resolves.toMatchObject({
      nextTarget: null,
      progress: { completedChapters: 1, totalChapters: 1, totalLessons: 1 },
      status: "ready",
    });

    await expect(
      updateCurrentUserCoursePlan({ courseId: course.id, input: { depth: "complete" } }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(getCourseLearningPath({ courseId: course.id })).resolves.toMatchObject({
      nextTarget: { lessonId: lessons[1]!.id },
      progress: { completedChapters: 0, totalChapters: 3 },
      status: "ready",
    });

    await expect(
      prisma.lessonProgress.count({ where: { completedAt: { not: null }, userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("lets explicit preview preferences override the saved starting point without changing it", async () => {
    const { course, lessons } = await courseTree();

    await updateCurrentUserCoursePlan({
      courseId: course.id,
      input: { depth: "complete", startingLevel: "advanced" },
    });

    await expect(
      getCourseLearningPath({ courseId: course.id, preferences: { depth: "overview" } }),
    ).resolves.toMatchObject({ nextTarget: { lessonId: lessons[0]!.id } });

    await expect(getCourseLearningPath({ courseId: course.id })).resolves.toMatchObject({
      nextTarget: { lessonId: lessons[3]!.id },
    });
  });

  it("rebuilds a saved focused intent from the actual replacement chapters on explicit resume", async () => {
    const { course, chapters, lessons, user } = await courseTree();

    await prisma.courseLearningPlan.create({
      data: {
        chapterIds: [],
        contentRevision: 0,
        courseId: course.id,
        depth: "focused",
        goal: "Prepare for a robotics project",
        startingKnowledge: "I know algebra",
        userId: user.id,
      },
    });

    vi.mocked(generateCoursePath, { partial: true }).mockResolvedValue({
      data: { chapterIds: [chapters[2]!.id], summary: "The robotics essentials" },
    });

    await expect(startCurrentUserCourse({ courseId: course.id })).resolves.toMatchObject({
      nextTarget: { lessonId: lessons[2]!.id },
      plan: { contentRevision: 1, goal: "Prepare for a robotics project" },
      status: "ready",
    });

    expect(generateCoursePath).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: "Prepare for a robotics project",
        startingKnowledge: "I know algebra",
      }),
    );
  });

  it("rejects a hidden-kind selection that leaves generated chapters without teaching", async () => {
    const { course } = await courseTree();

    await expect(
      updateCurrentUserCoursePlan({
        courseId: course.id,
        input: { depth: "overview", hiddenLessonKinds: ["explanation"] },
      }),
    ).resolves.toStrictEqual({ status: "invalid" });
  });

  it("rejects stale plan writes", async () => {
    const { course } = await courseTree();
    await updateCurrentUserCoursePlan({ courseId: course.id, input: { depth: "overview" } });

    await expect(
      updateCurrentUserCoursePlan({
        courseId: course.id,
        expectedRevision: 0,
        input: { depth: "complete" },
      }),
    ).resolves.toStrictEqual({ status: "conflict" });
  });

  it("never reveals another learner's private course or accepts a guest plan write", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);

    const course = await courseFixture({
      curriculumVersion: 2,
      format: "personalized",
      isPublished: true,
      userId: owner.id,
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: viewer });

    await expect(getCourseLearningPath({ courseId: course.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(
      updateCurrentUserCoursePlan({ courseId: course.id, input: { depth: "complete" } }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("preserves legacy continuation until an explicit new plan requests replacement", async () => {
    const { course } = await courseTree();
    const organization = await aiOrganizationFixture();

    await prisma.course.update({
      data: { curriculumVersion: 1, organizationId: organization.id },
      where: { id: course.id },
    });

    await expect(startCurrentUserCourse({ courseId: course.id })).resolves.toMatchObject({
      needsCurriculumUpdate: true,
      status: "ready",
    });

    await expect(
      startCurrentUserCourse({
        courseId: course.id,
        input: { depth: "complete", startingLevel: "advanced" },
      }),
    ).resolves.toMatchObject({
      courseId: course.id,
      resource: "curriculum",
      status: "generationRequired",
    });

    await expect(prisma.chapter.count({ where: { courseId: course.id } })).resolves.toBe(4);
  });

  it("starts existing authored course content without requesting unsupported AI replacement", async () => {
    const { course, lessons } = await courseTree();
    await prisma.course.update({ data: { curriculumVersion: 1 }, where: { id: course.id } });
    await prisma.chapter.updateMany({ data: { level: null }, where: { courseId: course.id } });

    await expect(startCurrentUserCourse({ courseId: course.id })).resolves.toMatchObject({
      needsCurriculumUpdate: false,
      needsPlan: false,
      nextTarget: { lessonId: lessons[0]?.id },
      status: "ready",
      supportsLearningPlan: false,
    });

    await expect(
      updateCurrentUserCoursePlan({ courseId: course.id, input: { depth: "overview" } }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      getCourseLearningPath({ courseId: course.id, preferences: { depth: "overview" } }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await prisma.lesson.update({
      data: { generationStatus: "pending" },
      where: { id: lessons[0]!.id },
    });

    await expect(getCourseLearningPath({ courseId: course.id })).resolves.toMatchObject({
      nextTarget: { generationStatus: "completed", lessonId: lessons[1]?.id },
      supportsLearningPlan: false,
    });

    await prisma.lesson.updateMany({
      data: { generationStatus: "pending" },
      where: { chapter: { courseId: course.id } },
    });

    await expect(startCurrentUserCourse({ courseId: course.id })).resolves.toMatchObject({
      nextTarget: null,
      progress: { completedLessons: 0, totalLessons: 4 },
      supportsLearningPlan: false,
    });
  });

  it("preserves a focused learner's chosen sequence without reteaching prerequisites already known", async () => {
    const { course, chapters } = await courseTree();
    const advanced = chapters[3]!;
    const intermediate = chapters[2]!;

    await prisma.chapter.update({
      data: {
        outcomes: ["Verify a deployed autonomous system"],
        prerequisiteIds: [chapters[1]!.id],
      },
      where: { id: advanced.id },
    });

    vi.mocked(generateCoursePath, { partial: true }).mockResolvedValue({
      data: {
        chapterIds: [advanced.id, intermediate.id],
        summary: "Apply what you know to verification",
      },
    });

    await expect(
      updateCurrentUserCoursePlan({
        courseId: course.id,
        input: {
          depth: "focused",
          goal: "Verify AI-assisted systems",
          startingKnowledge: "I already use all the foundations",
          startingLevel: "advanced",
        },
      }),
    ).resolves.toMatchObject({
      plan: { chapterIds: [advanced.id, intermediate.id] },
      status: "ready",
    });

    const sent = vi.mocked(generateCoursePath).mock.calls.at(-1)?.[0];

    expect(sent?.chapters.find((chapter) => chapter.id === advanced.id)).toMatchObject({
      outcomes: ["Verify a deployed autonomous system"],
    });

    await expect(getCourseLearningPath({ courseId: course.id })).resolves.toMatchObject({
      chapters: [{ id: advanced.id }, { id: intermediate.id }],
    });
  });

  it("rejects a selected prerequisite placed after the chapter that needs it", async () => {
    const { course, chapters, user } = await courseTree();

    await prisma.chapter.update({
      data: { prerequisiteIds: [chapters[1]!.id] },
      where: { id: chapters[3]!.id },
    });

    vi.mocked(generateCoursePath, { partial: true }).mockResolvedValue({
      data: { chapterIds: [chapters[3]!.id, chapters[1]!.id], summary: "An invalid sequence" },
    });

    await expect(
      updateCurrentUserCoursePlan({
        courseId: course.id,
        input: { depth: "focused", goal: "A new skill" },
      }),
    ).rejects.toThrow("prerequisite");

    await expect(
      prisma.courseLearningPlan.count({ where: { courseId: course.id, userId: user.id } }),
    ).resolves.toBe(0);
  });
});
