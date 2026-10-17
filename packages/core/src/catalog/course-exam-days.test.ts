import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getExamBlueprintCacheTag,
} from "../cache/tags";
import { startCourseGoal } from "../goals/start-course-goal";
import { getCourseExamDays } from "./course-exam-days";

const NOW = new Date("2020-09-28T12:00:00Z");

function edition(
  dates = ["2020-10-18", "2020-10-11"],
  year = 2020,
  timeZone: string | null = "UTC",
) {
  return {
    citations: [],
    dates: dates.map((date) => ({
      citation: { passage: "Exam day", sourceId: "notice" },
      date,
      kind: "exam",
      label: "Exam",
    })),
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone,
    year,
  };
}

async function examCourse({
  courseAttrs = {},
  storedEdition = edition(),
}: {
  courseAttrs?: Parameters<typeof courseFixture>[0];
  storedEdition?: ReturnType<typeof edition>;
} = {}) {
  const [course, blueprint] = await Promise.all([
    courseFixture({ format: "exam", isPublished: true, visibility: "public", ...courseAttrs }),
    examBlueprintFixture({ edition: storedEdition }),
  ]);

  // The course's outline teaches the one skill its exam gives it, so a start plans from it.
  const [band] = await courseBandsFixture({ courseId: course.id, levels: ["beginner"] });

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NOW,
      graph: {
        phases: [{ milestone: null, name: "Exam" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 1,
            name: band?.skill.name ?? "",
            phase: 0,
            skillId: band?.skill.id ?? "",
            weight: null,
          },
        ],
      },
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return { blueprint, course };
}

describe(getCourseExamDays, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("returns the notice's ascending exam days, with the same first day as a default course start", async () => {
    const [{ course, blueprint }, user] = await Promise.all([examCourse(), userFixture()]);

    await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
      days: ["2020-10-11", "2020-10-18"],
      estimated: false,
      timeZone: "UTC",
    });

    expect(cacheTag).toHaveBeenCalledWith(
      getCourseCacheTag(course.id),
      getCourseCurriculumCacheTag(course.id),
      getExamBlueprintCacheTag(blueprint.id),
    );

    mockSession(user.id);

    await expect(
      startCourseGoal({ courseId: course.id, input: { timeZone: "UTC" } }),
    ).resolves.toMatchObject({ goal: { targetDate: "2020-10-11" }, status: "created" });
  });

  it("rolls a past edition to the next estimated edition and agrees with course start", async () => {
    const [{ course }, user] = await Promise.all([
      examCourse({ storedEdition: edition(["2019-10-20", "2019-10-13"], 2019) }),
      userFixture(),
    ]);

    await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
      days: ["2020-10-11", "2020-10-18"],
      estimated: true,
      timeZone: "UTC",
    });

    mockSession(user.id);

    await expect(
      startCourseGoal({ courseId: course.id, input: { timeZone: "UTC" } }),
    ).resolves.toMatchObject({ goal: { targetDate: "2020-10-11" }, status: "created" });
  });

  it.each([
    {
      examTimeZone: "UTC",
      now: "2020-10-11T01:30:00Z",
      targetDate: "2020-10-18",
      timeZone: "America/Sao_Paulo",
    },
    {
      examTimeZone: "UTC",
      now: "2020-10-10T23:30:00Z",
      targetDate: "2020-10-11",
      timeZone: "Asia/Tokyo",
    },
    {
      examTimeZone: "Asia/Tokyo",
      now: "2020-10-10T23:30:00Z",
      targetDate: "2020-10-18",
      timeZone: "America/Sao_Paulo",
    },
  ])(
    "agrees with course start for an exam in $examTimeZone and a learner in $timeZone at $now",
    async ({ examTimeZone, now, targetDate, timeZone }) => {
      vi.setSystemTime(new Date(now));

      const [{ course }, user] = await Promise.all([
        examCourse({ storedEdition: edition(undefined, 2020, examTimeZone) }),
        userFixture(),
      ]);

      const exam = await getCourseExamDays(course.id);
      expect(exam?.days[0]).toBe(targetDate);
      expect(exam?.timeZone).toBe(examTimeZone);
      mockSession(user.id);

      await expect(
        startCourseGoal({ courseId: course.id, input: { timeZone } }),
      ).resolves.toMatchObject({ goal: { targetDate }, status: "created" });
    },
  );

  it.each([2020, 2019])(
    "uses Brazil's exam day before and after midnight for the known or estimated %i edition",
    async (year) => {
      const dates = year === 2020 ? ["2020-10-11", "2020-10-18"] : ["2019-10-13", "2019-10-20"];

      const [{ course }, user] = await Promise.all([
        examCourse({ storedEdition: edition(dates, year, "America/Sao_Paulo") }),
        userFixture(),
      ]);

      mockSession(user.id);
      vi.setSystemTime(new Date("2020-10-11T01:30:00Z"));

      await expect
        .soft(getCourseExamDays(course.id))
        .resolves.toStrictEqual({
          days: ["2020-10-11", "2020-10-18"],
          estimated: year !== 2020,
          timeZone: "America/Sao_Paulo",
        });

      await expect(
        startCourseGoal({ courseId: course.id, input: { timeZone: "Asia/Tokyo" } }),
      ).resolves.toMatchObject({ goal: { targetDate: "2020-10-11" }, status: "created" });

      vi.setSystemTime(new Date("2020-10-11T03:00:00Z"));

      await expect
        .soft(getCourseExamDays(course.id))
        .resolves.toStrictEqual({
          days: ["2020-10-18"],
          estimated: year !== 2020,
          timeZone: "America/Sao_Paulo",
        });

      const afterMidnightUser = await userFixture();
      mockSession(afterMidnightUser.id);

      await expect(
        startCourseGoal({ courseId: course.id, input: { timeZone: "Asia/Tokyo" } }),
      ).resolves.toMatchObject({ goal: { targetDate: "2020-10-18" }, status: "created" });
    },
  );

  it.each([2020, 2019])(
    "keeps the final Brazil exam day through the previous evening then rolls the %i edition",
    async (year) => {
      const dates = year === 2020 ? ["2020-10-11", "2020-10-18"] : ["2019-10-13", "2019-10-20"];

      const [{ course }, user] = await Promise.all([
        examCourse({ storedEdition: edition(dates, year, "America/Sao_Paulo") }),
        userFixture(),
      ]);

      mockSession(user.id);
      vi.setSystemTime(new Date("2020-10-18T01:30:00Z"));

      await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
        days: ["2020-10-18"],
        estimated: year !== 2020,
        timeZone: "America/Sao_Paulo",
      });

      await expect(
        startCourseGoal({ courseId: course.id, input: { timeZone: "UTC" } }),
      ).resolves.toMatchObject({ goal: { targetDate: "2020-10-18" }, status: "created" });

      vi.setSystemTime(new Date("2020-10-18T03:00:00Z"));

      await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
        days: ["2021-10-10", "2021-10-17"],
        estimated: true,
        timeZone: "America/Sao_Paulo",
      });

      const afterMidnightUser = await userFixture();
      mockSession(afterMidnightUser.id);

      await expect(
        startCourseGoal({ courseId: course.id, input: { timeZone: "UTC" } }),
      ).resolves.toMatchObject({ goal: { targetDate: "2021-10-10" }, status: "created" });
    },
  );

  it.each([2020, 2019])(
    "rolls forward on the final exam day of the known or estimated %i edition",
    async (year) => {
      vi.setSystemTime(new Date("2020-10-18T12:00:00Z"));
      const dates = year === 2020 ? ["2020-10-11", "2020-10-18"] : ["2019-10-13", "2019-10-20"];

      const [{ course }, user] = await Promise.all([
        examCourse({ storedEdition: edition(dates, year) }),
        userFixture(),
      ]);

      await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
        days: ["2021-10-10", "2021-10-17"],
        estimated: true,
        timeZone: "UTC",
      });

      mockSession(user.id);

      await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
        goal: { targetDate: "2021-10-10" },
        status: "created",
      });
    },
  );

  it("returns null for non-exam, unpublished and private courses, including their owner", async () => {
    const owner = await userFixture();

    const fixtures = await Promise.all([
      examCourse({ courseAttrs: { format: "core" } }),
      examCourse({ courseAttrs: { isPublished: false } }),
      examCourse({ courseAttrs: { userId: owner.id, visibility: "private" } }),
    ]);

    mockSession(owner.id);

    await Promise.all(
      fixtures.map(async ({ course }) => {
        await expect(getCourseExamDays(course.id)).resolves.toBeNull();
      }),
    );
  });

  it("returns null when the stored notice knows no exam days", async () => {
    const { course } = await examCourse({ storedEdition: edition([]) });
    await expect(getCourseExamDays(course.id)).resolves.toBeNull();
  });

  it("takes the same next open sitting as course start when earlier registration is closed", async () => {
    const storedEdition = edition(["2020-10-11", "2020-12-13"]);

    storedEdition.dates.push(
      {
        citation: { passage: "Closed", sourceId: "notice" },
        date: "2020-09-20",
        kind: "registrationEnd",
        label: "First registration",
      },
      {
        citation: { passage: "Open", sourceId: "notice" },
        date: "2020-11-20",
        kind: "registrationEnd",
        label: "Second registration",
      },
    );

    const [{ course }, user] = await Promise.all([examCourse({ storedEdition }), userFixture()]);

    await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
      days: ["2020-12-13"],
      estimated: false,
      timeZone: "UTC",
    });

    mockSession(user.id);

    await expect(
      startCourseGoal({ courseId: course.id, input: { timeZone: "UTC" } }),
    ).resolves.toMatchObject({ goal: { targetDate: "2020-12-13" }, status: "created" });
  });

  it("reads a revised notice edition immediately after an earlier read", async () => {
    const { course, blueprint } = await examCourse();
    await getCourseExamDays(course.id);

    await prisma.examBlueprint.update({
      data: { edition: edition(["2020-11-08", "2020-11-15"], 2020, "America/Sao_Paulo") },
      where: { id: blueprint.id },
    });

    await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
      days: ["2020-11-08", "2020-11-15"],
      estimated: false,
      timeZone: "America/Sao_Paulo",
    });
  });

  it.each([
    { now: "2020-09-28T12:00:00Z", timeZone: "UTC" },
    { now: "2020-09-29T01:30:00Z", timeZone: "America/Sao_Paulo" },
  ])("keeps registration open through today's deadline in $timeZone", async ({ now, timeZone }) => {
    vi.setSystemTime(new Date(now));
    const storedEdition = edition(["2020-10-11", "2020-12-13"], 2020, timeZone);

    storedEdition.dates.push({
      citation: { passage: "Register through today", sourceId: "notice" },
      date: "2020-09-28",
      kind: "registrationEnd",
      label: "First registration",
    });

    const [{ course }, user] = await Promise.all([examCourse({ storedEdition }), userFixture()]);

    await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
      days: ["2020-10-11"],
      estimated: false,
      timeZone,
    });

    mockSession(user.id);

    await expect(startCourseGoal({ courseId: course.id, input: {} })).resolves.toMatchObject({
      goal: { targetDate: "2020-10-11" },
      status: "created",
    });
  });

  it.each([null, "Invalid/Zone"])(
    "keeps UTC selection for a notice zone of %s",
    async (timeZone) => {
      vi.setSystemTime(new Date("2020-10-11T01:30:00Z"));

      const [{ course }, user] = await Promise.all([
        examCourse({ storedEdition: edition(undefined, 2020, timeZone) }),
        userFixture(),
      ]);

      await expect(getCourseExamDays(course.id)).resolves.toStrictEqual({
        days: ["2020-10-18"],
        estimated: false,
        timeZone: "UTC",
      });

      mockSession(user.id);

      await expect(
        startCourseGoal({ courseId: course.id, input: { timeZone: "America/Sao_Paulo" } }),
      ).resolves.toMatchObject({ goal: { targetDate: "2020-10-18" }, status: "created" });
    },
  );
});
