import {
  generateCourseOutline,
  streamCourseOutline,
} from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { createCourseIcon } from "@zoonk/core/library/courses/icon";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { mockLastRunEvent } from "../../../../mocks/workflow-runtime";
import { recordedOutput, replayStreamedOutline, taskResult } from "../_test-utils/recorded-outputs";
import { courseDetailsWorkflow } from "./course-details-workflow";
import { courseOutlineWorkflow } from "./course-outline-workflow";
import { writeOutlineBandStep } from "./steps/course-outline-steps";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({ exists: Promise.resolve(false), status: Promise.resolve("failed") })),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

// Model calls are external: the outline replays the real run's; identity search finds nothing to reuse.
vi.mock("@zoonk/ai/tasks/v2/curriculum/course-outline", () => ({
  generateCourseOutline: vi.fn(),
  streamCourseOutline: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));

// Drawing an icon is an image model's call: the mock says which course got one.
vi.mock("@zoonk/core/library/courses/icon", () => ({ createCourseIcon: vi.fn(async () => null) }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

type SkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];

const recordedGraph = recordedOutput<SkillGraph>("skill-graph");
const recordedOutline = recordedOutput<CourseOutline>("course-outline");

const scope = {
  generalGoal: "Understand how vaccines work",
  language: "en",
  ownerId: null,
  targetLanguage: null,
};

const TIMEOUT = 60_000;

/** A learner whose plan stands in for the recorded graph's skills until the outline lands. */
async function waitingGoal() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  const skills = await Promise.all(
    recordedGraph.skills.map((skill) =>
      skillFixture({ description: skill.description, name: skill.name }),
    ),
  );

  const idsByKey = Object.fromEntries(
    recordedGraph.skills.map((skill, index) => [skill.key, skills[index]?.id ?? ""]),
  );

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  await createGoalPlan({
    goalId: goal.id,
    graph: toGoalPlanGraph({ courseIdsByKey: {}, graph: recordedGraph, idsByKey }),
  });

  const bandSkills = recordedGraph.skills.map((skill) => ({
    description: skill.description,
    id: idsByKey[skill.key] ?? "",
    key: skill.key,
    name: skill.name,
  }));

  return { bandSkills, goal };
}

function lessonItems(goalId: string) {
  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", plan: { goalId } },
  });
}

/** An outline chapter of three interview lessons, each with a skill of its own. */
function interviewChapter(title: string, skillKeys: string[]) {
  return {
    description: `${title}.`,
    lessons: ["Perguntas situacionais", "Resultados de um projeto", "Pontos fortes"].map(
      (lesson) => ({
        canDo: `Responder: ${lesson}`,
        description: `${lesson} em entrevistas.`,
        estimatedMinutes: 3,
        skills: [`${lesson} ${crypto.randomUUID().slice(0, 6)}`],
        title: `${lesson} ${title}`,
      }),
    ),
    objectives: ["Responder perguntas de entrevista"],
    skillKeys,
    title,
    tools: [],
  };
}

/** A new band a learner waits on, whose first chapter an earlier attempt saved, then failed. */
async function writeAfterEarlyAttempt(firstStatus: "completed" | "failed") {
  const [{ bandSkills }, course] = await Promise.all([
    waitingGoal(),
    courseFixture({ outlineStatus: "running", title: "Immunology" }),
  ]);

  // An earlier attempt of this step saved the band's first chapter, then failed.
  const first = await libraryChapterFixture({ level: "overview", outlineStatus: firstStatus });

  await courseChapterFixture({
    chapterId: first.id,
    courseId: course.id,
    level: "overview",
    position: 0,
  });

  const band = await writeOutlineBandStep({
    courseId: course.id,
    plan: {
      courseTitle: course.title,
      extensions: [],
      isNewBand: true,
      level: "overview",
      material: null,
      nextPosition: 0,
      otherChapterTitles: [],
      skills: bandSkills,
      taughtElsewhere: [],
      withoutTools: false,
    },
    scope,
    waitedSkillId: bandSkills[0]?.id,
    workflowRunId: "outline-run",
  });

  return { band, course, first };
}

describe(courseOutlineWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
    vi.mocked(generateCourseOutline).mockResolvedValue(taskResult(recordedOutline));

    vi.mocked(streamCourseOutline).mockImplementation(
      replayStreamedOutline(recordedOutline) as never,
    );
  });

  // A test that says how another run stands leaves the next one the default.
  afterEach(() => {
    vi.mocked(getRun).mockReset();
  });

  it(
    "writes a new band's outline, turns the goal's stand-ins into lessons and starts the course's background work",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const result = await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
      });

      expect(result).toMatchObject({ bandsWritten: 1, status: "written" });

      expect(result.status === "written" && result.chapterIds).toHaveLength(
        recordedOutline.chapters.length,
      );

      const [storedCourse, placements, items] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          where: { courseId: course.id },
        }),
        lessonItems(goal.id),
      ]);

      expect(storedCourse).toMatchObject({ isPublished: true, outlineStatus: "completed" });

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        recordedOutline.chapters.map((_, index) => index),
      );

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId !== null)).toBe(true);

      // Its page details follow; level bands no goal needs are never written ahead.
      expect(start).toHaveBeenCalledExactlyOnceWith(courseDetailsWorkflow, [
        { analytics: undefined, courseId: course.id },
      ]);

      // The icon is drawn while the outline is written, not after the whole run.
      expect(createCourseIcon).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: course.id }),
      );
    },
  );

  it(
    "writes every band at the standard tier, never priority, and bands the plan gets to in days at the flex tier",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const half = Math.ceil(bandSkills.length / 2);

      await courseOutlineWorkflow({
        bands: [
          { level: "overview", skills: bandSkills.slice(0, half) },
          { level: "beginner", skills: bandSkills.slice(half) },
        ],
        courseId: course.id,
        scope,
        waitedSkillId: bandSkills[0]?.id,
      });

      expect(
        vi
          .mocked(streamCourseOutline)
          .mock.calls.map(([params]) => [params.level, params.serviceTier]),
      ).toStrictEqual([["overview", undefined]]);

      expect(
        vi
          .mocked(generateCourseOutline)
          .mock.calls.map(([params]) => [params.level, params.serviceTier]),
      ).toStrictEqual([["beginner", undefined]]);

      const later = await courseFixture({ outlineStatus: "pending", title: "Immunology" });
      vi.mocked(generateCourseOutline).mockClear();

      await courseOutlineWorkflow({
        background: true,
        bands: [{ level: "beginner", skills: bandSkills.slice(half) }],
        courseId: later.id,
        scope,
      });

      expect(
        vi.mocked(generateCourseOutline).mock.calls.map(([params]) => params.serviceTier),
      ).toStrictEqual(["flex"]);
    },
  );

  it(
    "writes a course's bands at once, so a later band doesn't wait for the first one to land",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const half = Math.ceil(bandSkills.length / 2);

      // The first band's outline lands only once the second band's started: one after the other,
      // the second would never start.
      const secondStarted = new Promise<boolean>((resolve) => {
        vi.mocked(generateCourseOutline).mockImplementation(async (params) => {
          resolve(params.level === "beginner");
          return taskResult(recordedOutline);
        });

        setTimeout(() => resolve(false), 5000);
      });

      vi.mocked(streamCourseOutline).mockImplementationOnce((async (params: never) => {
        await expect(secondStarted).resolves.toBe(true);
        return replayStreamedOutline(recordedOutline)(params);
      }) as never);

      await expect(
        courseOutlineWorkflow({
          bands: [
            { level: "overview", skills: bandSkills.slice(0, half) },
            { level: "beginner", skills: bandSkills.slice(half) },
          ],
          courseId: course.id,
          scope,
          waitedSkillId: bandSkills[0]?.id,
        }),
      ).resolves.toMatchObject({ status: "written" });
    },
  );

  it(
    "writes the band a learner waits on at the priority tier when its course is an exam's or a language's",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const examScope = {
        ...scope,
        exams: [{ name: "ENEM", style: "Interdisciplinary five-option items." }],
      };

      const half = Math.ceil(bandSkills.length / 2);

      await courseOutlineWorkflow({
        bands: [
          { level: "overview", skills: bandSkills.slice(0, half) },
          { level: "beginner", skills: bandSkills.slice(half) },
        ],
        courseId: course.id,
        scope: examScope,
        waitedSkillId: bandSkills[0]?.id,
      });

      // Only the band the learner waits on pays for priority; the next one is minutes away.
      expect(vi.mocked(streamCourseOutline).mock.calls[0]?.[0].serviceTier).toBe("priority");
      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].serviceTier).toBeUndefined();
    },
  );

  it(
    "saves the first chapter of a band a learner waits on while the rest is written, and re-plans the learner from it",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const replay = replayStreamedOutline(recordedOutline);
      const whileWriting: { placements: number; plannedLessons: number }[] = [];

      vi.mocked(streamCourseOutline).mockImplementation((async (
        params: Parameters<typeof replay>[0],
      ) => {
        const result = await replay(params);

        // The model is still writing the rest of the band here.
        const [placements, items] = await Promise.all([
          prisma.courseChapter.count({ where: { courseId: course.id } }),
          lessonItems(goal.id),
        ]);

        whileWriting.push({
          placements,
          plannedLessons: items.filter((item) => item.lessonId !== null).length,
        });

        return result;
      }) as never);

      const result = await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
        waitedSkillId: bandSkills[0]?.id,
      });

      expect(whileWriting).toStrictEqual([{ placements: 1, plannedLessons: expect.any(Number) }]);
      expect(whileWriting[0]?.plannedLessons).toBeGreaterThan(0);

      const [placements, items] = await Promise.all([
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          where: { courseId: course.id },
        }),
        lessonItems(goal.id),
      ]);

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        recordedOutline.chapters.map((_, index) => index),
      );

      expect(result.status === "written" && result.chapterIds).toStrictEqual(
        placements.map((placement) => placement.chapterId),
      );

      expect(items.every((item) => item.lessonId !== null)).toBe(true);
    },
  );

  it(
    "streams a band that exists when a learner waits on it, saving its first new chapter after the band's chapters",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, existing] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "completed", title: "Immunology" }),
        libraryChapterFixture({ level: "overview" }),
      ]);

      await courseChapterFixture({
        chapterId: existing.id,
        courseId: course.id,
        level: "overview",
        position: 0,
      });

      const result = await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
        waitedSkillId: bandSkills[0]?.id,
      });

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(streamCourseOutline).toHaveBeenCalledOnce();
      expect(placements[0]?.chapterId).toBe(existing.id);

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        placements.map((_, index) => index),
      );

      expect(result.status === "written" && result.chapterIds).toStrictEqual(
        placements.slice(1).map((placement) => placement.chapterId),
      );
    },
  );

  // Saving a chapter runs identity search over the shared test database's Library, which takes
  // seconds while other suites load it, like every other chapter-saving test here.
  describe(writeOutlineBandStep, { timeout: TIMEOUT }, () => {
    it("keeps the first chapter an earlier attempt finished, and writes the rest of the band after it", async () => {
      const { band, first } = await writeAfterEarlyAttempt("completed");

      expect(streamCourseOutline).not.toHaveBeenCalled();
      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].serviceTier).toBeUndefined();
      expect(band.early).toStrictEqual({ chapterId: first.id, goalIds: [], position: 0 });
      expect(band.chapters).toStrictEqual(recordedOutline.chapters.slice(1));
    });

    it("takes out a first chapter an earlier attempt didn't finish, and streams the band again", async () => {
      const { band, course, first } = await writeAfterEarlyAttempt("failed");

      expect(streamCourseOutline).toHaveBeenCalledOnce();
      expect(band.early?.chapterId).not.toBe(first.id);

      await expect(
        prisma.courseChapter.findMany({
          select: { chapterId: true },
          where: { courseId: course.id },
        }),
      ).resolves.toStrictEqual([{ chapterId: band.early?.chapterId }]);
    });
  });

  it(
    "frees the course for the next goal when a band fails, and counts the failure for the learner",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      vi.mocked(generateCourseOutline).mockRejectedValue(new Error("Provider unavailable"));

      await expect(
        courseOutlineWorkflow({
          analytics: { distinctId: goal.userId, goalId: goal.id, platform: "web" },
          bands: [{ level: "overview", skills: bandSkills }],
          courseId: course.id,
          scope,
        }),
      ).rejects.toThrow("Provider unavailable");

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ outlineRunId: "test-run-id", outlineStatus: "failed" });

      // Building the learner's plan counted "Plan Created" before this run.
      expect(trackServerEvent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          distinctId: goal.userId,
          name: "Generation Failed",
          properties: { content_kind: "course", model: null, task: "course-outline" },
          shared: expect.objectContaining({ platform: "web" }),
        }),
      );

      // The goal keeps its stand-ins, and a shared course gets no background work from a failed run.
      const items = await lessonItems(goal.id);

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId === null)).toBe(true);
      expect(start).not.toHaveBeenCalled();
    },
  );

  it("gives a private course no details or other bands", { timeout: TIMEOUT }, async () => {
    const [{ bandSkills }, owner] = await Promise.all([waitingGoal(), userFixture()]);

    const course = await courseFixture({
      outlineStatus: "pending",
      title: "Immunology",
      userId: owner.id,
      visibility: "private",
    });

    await expect(
      courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope: { ...scope, ownerId: owner.id },
      }),
    ).resolves.toMatchObject({ status: "written" });

    expect(start).not.toHaveBeenCalled();
  });

  it(
    "adds only the chapters that teach a later goal's missing skills to a band that exists",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, existing] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "completed", title: "Immunology" }),
        libraryChapterFixture({ level: "overview" }),
      ]);

      await courseChapterFixture({
        chapterId: existing.id,
        courseId: course.id,
        level: "overview",
        position: 0,
      });

      const [first, ...rest] = recordedOutline.chapters;

      vi.mocked(generateCourseOutline).mockResolvedValue(
        taskResult({
          ...recordedOutline,
          chapters: [...(first ? [{ ...first, skillKeys: [] }] : []), ...rest],
        }),
      );

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
      });

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        placements.map((_, index) => index),
      );

      expect(placements).toHaveLength(
        rest.filter((chapter) => chapter.skillKeys.length > 0).length + 1,
      );

      expect(placements[0]?.chapterId).toBe(existing.id);

      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].otherLevelChapters).toStrictEqual([
        existing.title,
      ]);
    },
  );

  it(
    "tells the outline which of the band's skills the course's other chapters already teach",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, otherSubject, chapter, otherChapter, lesson, otherLesson] =
        await Promise.all([
          waitingGoal(),
          courseFixture({ outlineStatus: "pending", title: "Immunology" }),
          courseFixture({ title: "Veterinary parasitology" }),
          libraryChapterFixture(),
          libraryChapterFixture(),
          libraryLessonFixture(),
          libraryLessonFixture(),
        ]);

      const [elsewhere, inOtherSubject, ...rest] = bandSkills;

      await Promise.all([
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
        courseChapterFixture({
          chapterId: otherChapter.id,
          courseId: otherSubject.id,
          position: 0,
        }),
        prisma.chapterLesson.createMany({
          data: [
            { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
            { chapterId: otherChapter.id, lessonId: otherLesson.id, position: 0 },
          ],
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: elsewhere?.id ?? "" }),
        lessonSkillFixture({ lessonId: otherLesson.id, skillId: inOtherSubject?.id ?? "" }),
      ]);

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
      });

      const [call] = vi.mocked(generateCourseOutline).mock.calls;

      expect(call?.[0].taughtElsewhere).toStrictEqual([elsewhere?.name]);

      // Another subject's lesson for a shared skill doesn't count: this course still teaches it.
      expect(call?.[0].requiredSkills?.map((skill) => skill.key)).toStrictEqual(
        [inOtherSubject, ...rest].map((skill) => skill?.key),
      );
    },
  );

  it(
    "asks an exam answered on paper for chapters without tools, even for skills a tool chapter teaches",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, practice, lesson] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Speech recognition" }),
        libraryChapterFixture({ tools: [{ essential: true, name: "Audio editor (Audacity)" }] }),
        libraryLessonFixture(),
      ]);

      const [withTool] = bandSkills;

      await Promise.all([
        courseChapterFixture({ chapterId: practice.id, courseId: course.id, position: 0 }),
        prisma.chapterLesson.create({
          data: { chapterId: practice.id, lessonId: lesson.id, position: 0 },
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: withTool?.id ?? "" }),
      ]);

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills, withToolChapters: false }],
        courseId: course.id,
        scope,
      });

      const [call] = vi.mocked(generateCourseOutline).mock.calls;

      expect(call?.[0]).toMatchObject({ taughtElsewhere: [], withoutTools: true });
      expect(call?.[0].requiredSkills?.map((skill) => skill.key)).toContain(withTool?.key);
    },
  );

  it(
    "waits while another run saves the course's other bands, then plans against what it saved",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, savedChapter] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineRunId: "bands-run", outlineStatus: "running", title: "Immunology" }),
        libraryChapterFixture({ level: "overview" }),
      ]);

      vi.mocked(getRun).mockReturnValueOnce({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      // While this run waits, the other run saves an overview chapter and lets the course go.
      vi.mocked(sleep).mockImplementationOnce(async () => {
        await courseChapterFixture({
          chapterId: savedChapter.id,
          courseId: course.id,
          level: "overview",
          position: 0,
        });

        await prisma.course.update({
          data: { outlineStatus: "completed" },
          where: { id: course.id },
        });
      });

      await expect(
        courseOutlineWorkflow({
          bands: [{ level: "overview", skills: bandSkills }],
          courseId: course.id,
          scope,
        }),
      ).resolves.toMatchObject({ status: "written" });

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id, level: "overview" },
      });

      expect(placements[0]?.chapterId).toBe(savedChapter.id);
      expect(placements.length).toBeGreaterThan(1);

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        placements.map((_, index) => index),
      );

      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].otherLevelChapters).toStrictEqual([
        savedChapter.title,
      ]);
    },
  );

  it(
    "writes a guest's band and replaces its stand-ins, but leaves the course's details and other bands to a learner with an account",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      await expect(
        courseOutlineWorkflow({
          bands: [{ level: "overview", skills: bandSkills }],
          courseId: course.id,
          forGuest: true,
          scope,
        }),
      ).resolves.toMatchObject({ bandsWritten: 1, status: "written" });

      const items = await lessonItems(goal.id);

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId !== null)).toBe(true);
      expect(start).not.toHaveBeenCalled();
      expect(createCourseIcon).not.toHaveBeenCalled();
    },
  );

  // Writes the whole recorded band, like the tests above that get the longer timeout.
  it(
    "leaves a shared course's background work to a learner with an account, not a guest's goal",
    { timeout: TIMEOUT },
    async () => {
      const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
      const chapter = await libraryChapterFixture();

      await Promise.all([
        prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
      ]);

      await expect(
        courseOutlineWorkflow({
          bands: [
            {
              level: "overview",
              skills: [
                { description: skill.description, id: skill.id, key: "k", name: skill.name },
              ],
            },
          ],
          courseId: course.id,
          forGuest: true,
          scope,
        }),
      ).resolves.toMatchObject({ status: "written" });

      expect(start).not.toHaveBeenCalled();
    },
  );

  it("writes nothing when the course already teaches every skill in another band", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    ]);

    const lesson = await libraryLessonFixture();

    await prisma.chapterLesson.create({
      data: { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
    });

    await expect(
      courseOutlineWorkflow({
        bands: [
          {
            level: "overview",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      }),
    ).resolves.toStrictEqual({ bandsWritten: 0, chapterIds: [], status: "written" });

    expect(generateCourseOutline).not.toHaveBeenCalled();

    // The course may still lack its page details; that run finds what's missing.
    expect(start).toHaveBeenCalledWith(courseDetailsWorkflow, [
      { analytics: undefined, courseId: course.id },
    ]);
  });

  it(
    "writes a skill's next chapter right after its last one, under a new title, and swaps its lessons into the plan",
    { timeout: TIMEOUT },
    async () => {
      const [user, course, skill, existing, later] = await Promise.all([
        userFixture(),
        courseFixture({
          language: "pt",
          outlineStatus: "completed",
          targetLanguage: "en",
          title: "Inglês",
        }),
        skillFixture({ language: "pt", name: `Descrever experiência ${crypto.randomUUID()}` }),
        libraryChapterFixture({
          language: "pt",
          targetLanguage: "en",
          title: "Candidaturas e entrevistas",
        }),
        libraryChapterFixture({ language: "pt", targetLanguage: "en", title: "Vida no trabalho" }),
      ]);

      const written = await Promise.all(
        ["Formação acadêmica", "Tarefas anteriores"].map((title) =>
          libraryLessonFixture({
            estimatedMinutes: 3,
            homeChapterId: existing.id,
            language: "pt",
            targetLanguage: "en",
            title,
          }),
        ),
      );

      await Promise.all([
        courseChapterFixture({ chapterId: existing.id, courseId: course.id, position: 0 }),
        courseChapterFixture({ chapterId: later.id, courseId: course.id, position: 1 }),
        prisma.chapterSkill.create({ data: { chapterId: existing.id, skillId: skill.id } }),
        prisma.chapterLesson.createMany({
          data: written.map((lesson, position) => ({
            chapterId: existing.id,
            lessonId: lesson.id,
            position,
          })),
        }),
      ]);

      // The plan keeps the graph's twelve lessons: two written and a stand-in for ten.
      const goal = await goalFixture({
        kind: "language",
        language: "pt",
        primaryCourseId: course.id,
        targetLanguage: "en",
        userId: user.id,
      });

      await prisma.plan.create({
        data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
      });

      await createGoalPlan({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Trabalho" }],
          skills: [
            {
              area: "Inglês",
              courseIds: [course.id],
              lessons: 12,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            },
          ],
        },
      });

      const ref = { description: skill.description, id: skill.id, key: skill.id, name: skill.name };

      // The model repeats the existing chapter, then writes two new ones and an unrelated chapter.
      vi.mocked(generateCourseOutline).mockResolvedValue(
        taskResult({
          chapters: [
            interviewChapter("Candidaturas e entrevistas", [ref.key]),
            interviewChapter("Entrevistas com perguntas situacionais", [ref.key]),
            interviewChapter("Negociação de salário", [ref.key]),
            interviewChapter("Vida no Canadá", []),
          ],
          uncoveredSkillKeys: [],
        }),
      );

      await courseOutlineWorkflow({
        bands: [{ extend: [{ lessons: 12, skill: ref }], level: "beginner", skills: [] }],
        courseId: course.id,
        scope: { generalGoal: null, language: "pt", ownerId: null, targetLanguage: "en" },
      });

      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].extendSkills).toStrictEqual([
        {
          chapters: [{ lessons: written.map((lesson) => lesson.title), title: existing.title }],
          description: skill.description,
          key: ref.key,
          lessons: 10,
          name: skill.name,
        },
      ]);

      const placements = await prisma.courseChapter.findMany({
        include: { chapter: { select: { title: true } } },
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      // The continuation goes right after the skill's chapter, before what builds on it.
      expect(
        placements.map((placement) => [placement.position, placement.chapter.title]),
      ).toStrictEqual([
        [0, "Candidaturas e entrevistas"],
        [1, "Entrevistas com perguntas situacionais"],
        [2, "Vida no trabalho"],
      ]);

      // The goal re-planned: the new chapter's lessons follow the skill's earlier ones and replace
      // part of the stand-in, which still plans the rest.
      const items = await lessonItems(goal.id);

      const lessons = await prisma.lesson.findMany({
        where: { id: { in: items.flatMap((item) => item.lessonId ?? []) } },
      });

      const titleOf = (lessonId: string | null) =>
        lessons.find((row) => row.id === lessonId)?.title;

      expect(
        items.map((item) => (item.lessonId ? titleOf(item.lessonId) : item.skillId)),
      ).toStrictEqual([
        "Formação acadêmica",
        "Tarefas anteriores",
        "Perguntas situacionais Entrevistas com perguntas situacionais",
        "Resultados de um projeto Entrevistas com perguntas situacionais",
        "Pontos fortes Entrevistas com perguntas situacionais",
        skill.id,
      ]);
    },
  );

  // Lucas's session preparation asked for one ENEM course's "intermediate" band twice in one run (a
  // skill's next chapter and another skill's first ones): both bands placed their chapters from
  // the same position, and the run failed on the course's unique chapter places.
  it(
    "writes a level a run lists twice as one band, so its chapters never claim the same place",
    { timeout: TIMEOUT },
    async () => {
      const [course, extended, missing, existing] = await Promise.all([
        courseFixture({ language: "pt", outlineStatus: "completed", title: "Inglês" }),
        skillFixture({ language: "pt", name: `Descrever experiência ${crypto.randomUUID()}` }),
        skillFixture({ language: "pt", name: `Negociar salário ${crypto.randomUUID()}` }),
        libraryChapterFixture({ language: "pt", title: "Candidaturas e entrevistas" }),
      ]);

      const written = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: existing.id,
        language: "pt",
        title: "Formação acadêmica",
      });

      await Promise.all([
        courseChapterFixture({ chapterId: existing.id, courseId: course.id, position: 0 }),
        prisma.chapterSkill.create({ data: { chapterId: existing.id, skillId: extended.id } }),
        prisma.chapterLesson.create({
          data: { chapterId: existing.id, lessonId: written.id, position: 0 },
        }),
        lessonSkillFixture({ lessonId: written.id, skillId: extended.id }),
      ]);

      const toRef = (skill: typeof extended) => ({
        description: skill.description,
        id: skill.id,
        key: skill.id,
        name: skill.name,
      });

      // Each outline call writes its own chapters, so two calls for one level would place
      // different chapters in the same places.
      vi.mocked(generateCourseOutline)
        .mockResolvedValueOnce(
          taskResult({
            chapters: [
              interviewChapter("Entrevistas com perguntas situacionais", [extended.id]),
              interviewChapter("Negociação de salário", [missing.id]),
            ],
            uncoveredSkillKeys: [],
          }),
        )
        .mockResolvedValueOnce(
          taskResult({
            chapters: [
              interviewChapter("Entrevistas técnicas", [extended.id]),
              interviewChapter("Benefícios e contratos", [missing.id]),
            ],
            uncoveredSkillKeys: [],
          }),
        );

      const result = await courseOutlineWorkflow({
        bands: [
          { level: "beginner", skills: [toRef(missing)] },
          { extend: [{ lessons: 12, skill: toRef(extended) }], level: "beginner", skills: [] },
        ],
        courseId: course.id,
        scope: { generalGoal: null, language: "pt", ownerId: null, targetLanguage: null },
      });

      expect(result).toMatchObject({ bandsWritten: 1, status: "written" });

      expect(
        vi
          .mocked(generateCourseOutline)
          .mock.calls.map(([params]) => [
            params.requiredSkills?.map((skill) => skill.key),
            params.extendSkills?.map((skill) => skill.key),
          ]),
      ).toStrictEqual([[[missing.id], [extended.id]]]);

      const placements = await prisma.courseChapter.findMany({
        include: { chapter: { select: { title: true } } },
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(
        placements.map((placement) => [placement.position, placement.chapter.title]),
      ).toStrictEqual([
        [0, "Candidaturas e entrevistas"],
        [1, "Entrevistas com perguntas situacionais"],
        [2, "Negociação de salário"],
      ]);
    },
  );

  it("takes the course over from a run that stalled instead of joining it forever", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    ]);

    const lesson = await libraryLessonFixture();

    await prisma.chapterLesson.create({
      data: { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
    });

    // A server restart left the run that held the course saying it's running, an hour after its
    // last step started. Cancelling it frees the course's token.
    const cancel = vi.fn(() => {
      mockHookConflict(null);
      return Promise.resolve();
    });

    vi.mocked(getRun).mockReturnValue({
      cancel,
      exists: Promise.resolve(true),
      status: Promise.resolve("running"),
    } as unknown as ReturnType<typeof getRun>);

    mockHookConflict({ returnValue: new Promise(() => {}), runId: "stalled-run" });

    mockLastRunEvent("stalled-run", {
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      eventType: "step_started",
    });

    await expect(
      courseOutlineWorkflow({
        bands: [
          {
            level: "overview",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      }),
    ).resolves.toStrictEqual({ bandsWritten: 0, chapterIds: [], status: "written" });

    expect(cancel).toHaveBeenCalledOnce();
  });

  it("waits for the run already writing the course, then writes what is still missing once", async () => {
    const course = await courseFixture();
    mockHookConflict({ returnValue: Promise.resolve({ status: "written" }), runId: "owner-run" });

    const input = {
      bands: [{ level: "overview" as const, skills: [] }],
      courseId: course.id,
      scope,
    };

    await expect(courseOutlineWorkflow(input)).resolves.toStrictEqual({ status: "joined" });
    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [{ ...input, attempt: 1 }]);

    vi.mocked(start).mockClear();

    await expect(courseOutlineWorkflow({ ...input, attempt: 1 })).resolves.toStrictEqual({
      status: "joined",
    });

    expect(start).not.toHaveBeenCalled();
  });
});
