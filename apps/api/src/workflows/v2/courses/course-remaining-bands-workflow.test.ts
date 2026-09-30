import { randomUUID } from "node:crypto";
import { generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { type CourseLevel, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildSkillIdentityKey } from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRun, start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { courseDetailsWorkflow } from "./course-details-workflow";
import { courseRemainingBandsWorkflow } from "./course-remaining-bands-workflow";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

// Model calls are external: each band replays the real run's recorded outline, and identity
// search finds nothing to reuse.
vi.mock("@zoonk/ai/tasks/v2/curriculum/course-outline", () => ({ generateCourseOutline: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("@zoonk/core/analytics/server", () => ({
  trackServerEvent: vi.fn(),
  trackSystemEvent: vi.fn(),
}));

type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];
type OutlineParams = Parameters<typeof generateCourseOutline>[0];
type OutlineChapter = CourseOutline["chapters"][number];

const recordedOutline = recordedOutput<CourseOutline>("course-outline");
const TIMEOUT = 60_000;

/** Two lessons, renamed for this test; the first can teach a given skill. */
function renameLessons({
  chapter,
  firstSkill,
  id,
}: {
  chapter: OutlineChapter;
  firstSkill?: string;
  id: string;
}): OutlineChapter["lessons"] {
  const [first, second] = chapter.lessons.map((lesson) => ({
    ...lesson,
    skills: [`${lesson.skills[0]} ${id}`],
    title: `${lesson.title} ${id}`,
  }));

  return [first && { ...first, skills: firstSkill ? [firstSkill] : first.skills }, second].filter(
    (lesson) => lesson !== undefined,
  );
}

/**
 * Two chapters of the recorded outline, renamed so each band's chapters, lessons and skills are
 * its own. The recorded outline predates chapter tools.
 */
function uniqueOutline(firstSkill?: string): CourseOutline {
  const id = randomUUID().slice(0, 8);
  const [first, second] = recordedOutline.chapters;

  const chapters = [
    first && { ...first, lessons: renameLessons({ chapter: first, firstSkill, id }) },
    second && { ...second, lessons: renameLessons({ chapter: second, id }) },
  ].filter((chapter) => chapter !== undefined);

  return {
    chapters: chapters.map((chapter) => ({
      ...chapter,
      skillKeys: [],
      title: `${chapter.title} ${id}`,
      tools: [],
    })),
    uncoveredSkillKeys: [],
  };
}

/** Every band gets its own outline; `write` can change what one band's call does. */
function mockOutlines(write?: (params: OutlineParams) => Promise<CourseOutline | null>) {
  vi.mocked(generateCourseOutline).mockImplementation(async (params) => {
    const outline = (await write?.(params)) ?? uniqueOutline();
    return taskResult(outline) as never;
  });
}

/** A published shared course whose overview band a goal already outlined. */
async function outlinedCourse(attrs?: Parameters<typeof courseFixture>[0]) {
  const [course, chapter] = await Promise.all([
    courseFixture({ isPublished: true, outlineStatus: "completed", title: "Immunology", ...attrs }),
    libraryChapterFixture({ level: "overview", title: `Vaccines ${randomUUID()}` }),
  ]);

  const firstLevel = attrs?.targetLanguage ? "beginner" : "overview";

  await courseChapterFixture({
    chapterId: chapter.id,
    courseId: course.id,
    level: firstLevel,
    position: 0,
  });

  return { chapter, course };
}

function placements(courseId: string) {
  return prisma.courseChapter.findMany({
    orderBy: [{ level: "asc" }, { position: "asc" }],
    where: { courseId },
  });
}

function requestedLevels(): CourseLevel[] {
  return vi
    .mocked(generateCourseOutline)
    .mock.calls.map(([params]) => params.level)
    .toSorted();
}

describe(courseRemainingBandsWorkflow, () => {
  beforeEach(() => {
    mockOutlines();
    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });

    vi.mocked(getRun).mockReturnValue({
      exists: Promise.resolve(false),
      status: Promise.resolve("failed"),
    } as never);

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${randomUUID().slice(0, 8)}`] })),
        }) as never,
    );
  });

  it(
    "writes every band a shared course is missing whole at the flex tier, then starts its details",
    { timeout: TIMEOUT },
    async () => {
      const { chapter, course } = await outlinedCourse();

      const result = await courseRemainingBandsWorkflow({ courseId: course.id });
      const stored = await placements(course.id);
      const added = stored.filter((placement) => placement.level !== "overview");

      expect(result).toStrictEqual({
        bandsWritten: 3,
        chapterIds: added.map((placement) => placement.chapterId),
        status: "written",
      });

      expect(requestedLevels()).toStrictEqual(["advanced", "beginner", "intermediate"]);

      // Nobody waits on these bands: the regular writer answers them at the flex tier, with no
      // goal skills, told what the course's other bands already teach.
      expect(
        vi
          .mocked(generateCourseOutline)
          .mock.calls.every(
            ([params]) =>
              params.serviceTier === "flex" &&
              params.requiredSkills?.length === 0 &&
              params.otherLevelChapters?.includes(chapter.title),
          ),
      ).toBe(true);

      expect(stored.map(({ level, position }) => `${level}:${position}`)).toStrictEqual([
        "overview:0",
        "beginner:0",
        "beginner:1",
        "intermediate:0",
        "intermediate:1",
        "advanced:0",
        "advanced:1",
      ]);

      const [storedCourse, lessonCount] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
        prisma.chapterLesson.count({
          where: { chapterId: { in: added.map((placement) => placement.chapterId) } },
        }),
      ]);

      expect(storedCourse.outlineStatus).toBe("completed");
      // Two lessons per chapter and each chapter's challenge.
      expect(lessonCount).toBe(added.length * 3);

      expect(start).toHaveBeenCalledWith(courseDetailsWorkflow, [
        { analytics: undefined, courseId: course.id },
      ]);
    },
  );

  it(
    "re-plans a goal waiting on a skill one of the new band's lessons teaches",
    { timeout: TIMEOUT },
    async () => {
      const skillName = `Explain herd immunity ${randomUUID()}`;
      const user = await userFixture();

      const [{ course }, skill, goal] = await Promise.all([
        outlinedCourse(),
        skillFixture({
          identityKey: buildSkillIdentityKey({ name: skillName, targetLanguage: null }),
          name: skillName,
        }),
        goalFixture({ userId: user.id }),
      ]);

      await prisma.plan.create({
        data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
      });

      await createGoalPlan({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: "Explain herd immunity", name: "Vaccines" }],
          skills: [
            { area: null, lessons: 1, name: skillName, phase: 0, skillId: skill.id, weight: null },
          ],
        },
      });

      mockOutlines(async ({ level }) =>
        level === "intermediate" ? uniqueOutline(skillName) : null,
      );

      await courseRemainingBandsWorkflow({ courseId: course.id });

      const items = await prisma.planItem.findMany({
        where: { kind: "lesson", plan: { goalId: goal.id }, skillId: skill.id },
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId !== null)).toBe(true);
    },
  );

  it(
    "drops a band a goal wrote meanwhile and leaves a band that failed for the next goal",
    { timeout: TIMEOUT },
    async () => {
      const { course } = await outlinedCourse();
      const goalChapter = await libraryChapterFixture({ level: "advanced" });

      mockOutlines(async ({ level }) => {
        if (level === "intermediate") {
          throw new Error("Provider unavailable");
        }

        if (level === "advanced") {
          // A learner's goal needed the advanced band while it was being written.
          await courseChapterFixture({
            chapterId: goalChapter.id,
            courseId: course.id,
            level: "advanced",
            position: 0,
          });
        }

        return null;
      });

      await expect(courseRemainingBandsWorkflow({ courseId: course.id })).resolves.toMatchObject({
        bandsWritten: 1,
        status: "written",
      });

      const stored = await placements(course.id);

      expect([...new Set(stored.map((placement) => placement.level))]).toStrictEqual([
        "overview",
        "beginner",
        "advanced",
      ]);

      expect(
        stored
          .filter((placement) => placement.level === "advanced")
          .map((placement) => placement.chapterId),
      ).toStrictEqual([goalChapter.id]);

      // No learner waited on the band that failed, so it counts under the system.
      expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
        name: "Generation Failed",
        properties: { content_kind: "course", model: null, task: "course-remaining-bands" },
      });
    },
  );

  it(
    "ends the course's claim as failed when saving a band fails, and counts it as a failed generation",
    { timeout: TIMEOUT },
    async () => {
      const { course } = await outlinedCourse();
      vi.mocked(generateSearchTerms).mockRejectedValue(new Error("Provider unavailable"));

      await expect(courseRemainingBandsWorkflow({ courseId: course.id })).rejects.toThrow(
        "Provider unavailable",
      );

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ outlineStatus: "failed" });

      expect(trackSystemEvent).toHaveBeenCalledExactlyOnceWith({
        name: "Generation Failed",
        properties: { content_kind: "course", model: null, task: "course-remaining-bands" },
      });
    },
  );

  it("writes the bands without the claim, and leaves them for later when a learner's run keeps the course busy", async () => {
    const { course } = await outlinedCourse({
      outlineRunId: "learner-run",
      outlineStatus: "running",
    });

    vi.mocked(getRun).mockReturnValue({
      exists: Promise.resolve(true),
      status: Promise.resolve("running"),
    } as never);

    await expect(courseRemainingBandsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      bandsWritten: 0,
      chapterIds: [],
      status: "written",
    });

    expect(generateCourseOutline).toHaveBeenCalledTimes(3);
    await expect(placements(course.id)).resolves.toHaveLength(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("asks a language course only for its missing CEFR bands, never an overview", async () => {
    const { course } = await outlinedCourse({ targetLanguage: "es", title: "Espanhol" });
    mockOutlines(async () => ({ chapters: [], uncoveredSkillKeys: [] }));

    await expect(courseRemainingBandsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      bandsWritten: 0,
      chapterIds: [],
      status: "written",
    });

    expect(requestedLevels()).toStrictEqual(["advanced", "intermediate"]);
  });

  it("does nothing for a private course, a course without an outline or one another run is completing", async () => {
    const owner = await userFixture();

    const [{ course: privateCourse }, emptyCourse, { course: busyCourse }] = await Promise.all([
      outlinedCourse({ userId: owner.id, visibility: "private" }),
      courseFixture(),
      outlinedCourse(),
    ]);

    const nothing = { bandsWritten: 0, chapterIds: [], status: "written" };

    await expect(
      courseRemainingBandsWorkflow({ courseId: privateCourse.id }),
    ).resolves.toStrictEqual(nothing);

    await expect(courseRemainingBandsWorkflow({ courseId: emptyCourse.id })).resolves.toStrictEqual(
      nothing,
    );

    mockHookConflict({ returnValue: Promise.resolve(nothing), runId: "bands-run" });

    await expect(courseRemainingBandsWorkflow({ courseId: busyCourse.id })).resolves.toStrictEqual({
      status: "joined",
    });

    expect(generateCourseOutline).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
