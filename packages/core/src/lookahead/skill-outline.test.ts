import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { addDays } from "../plans/planner/plan-calendar";
import { getSkillOutline, requestSkillOutline } from "./skill-outline";

/**
 * A learner's plan whose topics are all months away: stand-ins for skills of one course, the first
 * `beginner` ones in one band and an `intermediate` one in another.
 */
async function farPlan({ beginner = 2, isAnonymous = false } = {}) {
  const user = await userFixture();

  if (isAnonymous) {
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
  }

  const [goal, course, skills, later] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Learn statistics", userId: user.id }),
    courseFixture({ language: "en" }),
    Promise.all(Array.from({ length: beginner }, () => skillFixture({ level: "beginner" }))),
    skillFixture({ level: "intermediate" }),
  ]);

  const all = [...skills, later];

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "One" }],
      skills: all.map((skill) => ({
        area: null,
        courseIds: [course.id],
        lessons: 12,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const today = getDateInTimeZone({ date: new Date(), timeZone: "UTC" });

  await Promise.all(
    all.map((skill, position) =>
      planItemFixture({
        planId: plan.id,
        position,
        scheduledFor: addDays(today, 60 + position),
        skillId: skill.id,
      }),
    ),
  );

  return { course, goal, later, skills, user };
}

/** The run a tap started ended: until then, the course's other topics read as being written. */
function endOutlineRun(courseId: string) {
  return prisma.course.update({ data: { outlineStatus: "completed" }, where: { id: courseId } });
}

function countOutlineUses(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "outline", userId } });
}

describe(requestSkillOutline, () => {
  it("starts the outline of a far topic's band, with the plan's other topics in it, and counts it once", async () => {
    const { course, goal, later, skills, user } = await farPlan();
    const [first, second] = skills;
    mockSession(user.id);

    const request = await requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" });

    expect(request).toMatchObject({
      analytics: { distinctId: user.id, goalId: goal.id },
      forGuest: false,
      need: {
        bands: [{ level: "beginner", skills: [{ id: first?.id }, { id: second?.id }] }],
        courseId: course.id,
      },
      status: "start",
    });

    // The topic's band only: the intermediate topic waits for its own.
    const bands = request.status === "start" ? request.need.bands : [];
    expect(bands.flatMap((band) => band.skills.map((skill) => skill.id))).not.toContain(later.id);

    // Asking again for the same topic (a run that failed, a second tap) never counts twice.
    await requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" });
    await expect(countOutlineUses(user.id)).resolves.toBe(1);
  });

  it("reads as being written from the tap on, before the run it starts takes the course", async () => {
    const { course, goal, skills, user } = await farPlan();
    const skillId = skills[0]?.id ?? "";
    mockSession(user.id);

    await expect(requestSkillOutline({ goalId: goal.id, skillId })).resolves.toMatchObject({
      status: "start",
    });

    await expect(getSkillOutline({ goalId: goal.id, skillId })).resolves.toStrictEqual({
      outline: { chapters: [], status: "writing" },
      status: "ready",
    });

    // A run that never came (its start failed) stops holding the topic once the wait is stale.
    await prisma.course.update({
      data: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) },
      where: { id: course.id },
    });

    await expect(getSkillOutline({ goalId: goal.id, skillId })).resolves.toStrictEqual({
      outline: { chapters: [], status: "available" },
      status: "ready",
    });
  });

  it("starts nothing and counts nothing for a topic being written or already outlined", async () => {
    const { course, goal, skills, user } = await farPlan();
    const [first] = skills;
    mockSession(user.id);

    await prisma.course.update({ data: { outlineStatus: "running" }, where: { id: course.id } });

    await expect(
      requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ status: "writing" });

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ outline: { chapters: [], status: "writing" }, status: "ready" });

    // Another learner's outline wrote the topic's chapter since.
    const [chapter, lesson] = await Promise.all([
      libraryChapterFixture({ title: "Means and medians" }),
      libraryLessonFixture(),
      prisma.course.update({ data: { outlineStatus: "completed" }, where: { id: course.id } }),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: first?.id ?? "" }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
    ]);

    await expect(
      requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({
      outline: {
        chapters: [{ chapterId: chapter.id, title: "Means and medians" }],
        status: "ready",
      },
      status: "ready",
    });

    await expect(countOutlineUses(user.id)).resolves.toBe(0);
  });

  it("shows a topic its course teaches in part, from a lesson of another chapter, without writing", async () => {
    const { course, goal, skills, user } = await farPlan();
    const [first] = skills;
    mockSession(user.id);

    const [chapter, lesson] = await Promise.all([
      libraryChapterFixture({ title: "Asking good questions" }),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: first?.id ?? "" }),
    ]);

    await expect(
      requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ status: "ready" });

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({
      outline: {
        chapters: [{ chapterId: chapter.id, title: "Asking good questions" }],
        status: "ready",
      },
      status: "ready",
    });

    await expect(countOutlineUses(user.id)).resolves.toBe(0);
  });

  it("caps a free learner's lesson plans at three a day, and a guest's at one", async () => {
    const free = await farPlan({ beginner: 4 });
    mockSession(free.user.id);

    const requests = [];

    for (const skill of free.skills) {
      // oxlint-disable-next-line no-await-in-loop -- each claim counts the ones before it.
      requests.push(await requestSkillOutline({ goalId: free.goal.id, skillId: skill.id }));

      // oxlint-disable-next-line no-await-in-loop -- the next claim reads the course as it ended.
      await endOutlineRun(free.course.id);
    }

    expect(requests.map((request) => request.status)).toStrictEqual([
      "start",
      "start",
      "start",
      "refused",
    ]);

    expect(requests[3]).toMatchObject({
      decision: {
        limit: { limit: 3, period: "day", resource: "outline", tier: "free" },
        status: "limitReached",
      },
    });

    const guest = await farPlan({ isAnonymous: true });
    const [first, second] = guest.skills;
    mockGuestSession(guest.user.id);

    await expect(
      requestSkillOutline({ goalId: guest.goal.id, skillId: first?.id ?? "" }),
    ).resolves.toMatchObject({ forGuest: true, status: "start" });

    await endOutlineRun(guest.course.id);

    await expect(
      requestSkillOutline({ goalId: guest.goal.id, skillId: second?.id ?? "" }),
    ).resolves.toMatchObject({
      decision: { limit: { period: "total", tier: "guest" }, status: "limitReached" },
      status: "refused",
    });
  });

  it("finds nothing for a topic outside the learner's plan or another learner's goal", async () => {
    const [{ goal, user }, stranger, outside] = await Promise.all([
      farPlan(),
      userFixture(),
      skillFixture(),
    ]);

    mockSession(user.id);

    await expect(
      requestSkillOutline({ goalId: goal.id, skillId: outside.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(stranger.id);

    await expect(getSkillOutline({ goalId: goal.id, skillId: outside.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
