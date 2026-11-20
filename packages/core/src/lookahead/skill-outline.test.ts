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
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { addDays } from "../plans/planner/plan-calendar";
import { getSkillOutline, requestSkillOutline } from "./skill-outline";
import { endSkillOutlineAsk } from "./skill-outline-ask";

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

function askOf(request: Awaited<ReturnType<typeof requestSkillOutline>>) {
  if (request.status !== "start") {
    throw new Error(`Expected the request to start a run, got ${request.status}`);
  }

  return request.ask;
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

    const bands = request.status === "start" ? request.need.bands : [];
    expect(bands.flatMap((band) => band.skills.map((skill) => skill.id))).not.toContain(later.id);

    await requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" });
    await expect(countOutlineUses(user.id)).resolves.toBe(1);
  });

  it("reads as being written from the tap on, until the run it started ends or the ask goes stale", async () => {
    const { goal, skills, user } = await farPlan();
    const [first, second] = skills;
    mockSession(user.id);

    const request = await requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" });

    expect(request).toMatchObject({
      ask: { goalId: goal.id, skillId: first?.id },
      status: "start",
    });

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ outline: { chapters: [], status: "writing" }, status: "ready" });

    await endSkillOutlineAsk(askOf(request));

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ outline: { chapters: [], status: "available" }, status: "ready" });

    await requestSkillOutline({ goalId: goal.id, skillId: second?.id ?? "" });

    await prisma.skillOutlineAsk.updateMany({
      data: { askedAt: new Date(Date.now() - 60 * 60 * 1000) },
      where: { goalId: goal.id },
    });

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: second?.id ?? "" }),
    ).resolves.toStrictEqual({ outline: { chapters: [], status: "available" }, status: "ready" });
  });

  it("writes a topic while another learner's outline runs on its course, and counts it once", async () => {
    const { course, goal, skills, user } = await farPlan();
    const [first] = skills;
    mockSession(user.id);

    await prisma.course.update({ data: { outlineStatus: "running" }, where: { id: course.id } });

    await expect(
      getSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ outline: { chapters: [], status: "available" }, status: "ready" });

    await expect(
      requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toMatchObject({ need: { courseId: course.id }, status: "start" });

    await expect(
      requestSkillOutline({ goalId: goal.id, skillId: first?.id ?? "" }),
    ).resolves.toStrictEqual({ status: "writing" });

    const [chapter, lesson] = await Promise.all([
      libraryChapterFixture({ title: "Means and medians" }),
      libraryLessonFixture(),
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

    await expect(countOutlineUses(user.id)).resolves.toBe(1);
  });

  it("asks again for free after its run ended, and an earlier run's end leaves the new ask", async () => {
    freezeClock();

    const { goal, skills, user } = await farPlan();
    const skillId = skills[0]?.id ?? "";
    mockSession(user.id);

    const first = askOf(await requestSkillOutline({ goalId: goal.id, skillId }));
    await endSkillOutlineAsk(first);

    vi.advanceTimersByTime(1000);

    await expect(requestSkillOutline({ goalId: goal.id, skillId })).resolves.toMatchObject({
      status: "start",
    });

    await endSkillOutlineAsk(first);

    await expect(getSkillOutline({ goalId: goal.id, skillId })).resolves.toStrictEqual({
      outline: { chapters: [], status: "writing" },
      status: "ready",
    });

    await expect(countOutlineUses(user.id)).resolves.toBe(1);
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
    freezeClock();

    const free = await farPlan({ beginner: 4 });
    mockSession(free.user.id);

    const requests = [];

    for (const skill of free.skills) {
      // oxlint-disable-next-line no-await-in-loop -- each claim counts the ones before it.
      requests.push(await requestSkillOutline({ goalId: free.goal.id, skillId: skill.id }));
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
