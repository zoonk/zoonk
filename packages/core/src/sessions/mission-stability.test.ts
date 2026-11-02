import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getPronunciationReviews } from "../language/pronunciation/get-pronunciation-reviews";
import { getBuddyStatus } from "../milestones/get-buddy-status";
import { getTodayStudySession } from "./_test-utils/open-today";
import { followPlanChangeToday } from "./_utils/refresh-day-session";
import { toBlockPayload } from "./block-payload";
import { ensureStudySession } from "./ensure-study-session";
import { getStudySession } from "./get-study-session";
import { getStudySessionSummary } from "./get-study-session-summary";
import { settleMissions } from "./missions/settle-missions";

async function buildDay() {
  const user = await userFixture();
  const goal = await goalFixture({ dailyMinutes: 20, timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  const lesson = await libraryLessonFixture({ estimatedMinutes: 8 });
  const localDate = new Date("2026-10-13T00:00:00Z");

  const item = await planItemFixture({
    lessonId: lesson.id,
    planId: plan.id,
    scheduledFor: localDate,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  const session = await ensureStudySession({ goal, localDate, timeZone: "UTC", userId: user.id });
  return { goal, item, lesson, localDate, session, user };
}

describe("stored daily missions", () => {
  it("keeps an unstarted learner's picks on repeated reads of Today on the same local day", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const { goal, session } = await buildDay();
    const before = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    const first = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    vi.setSystemTime(new Date("2026-10-13T10:01:00Z"));
    const second = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    const after = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });

    expect(first.status).toBe("ready");
    expect(second.status === "ready" && second.session.id).toBe(session.id);

    expect(second.status === "ready" && second.session.missions).toStrictEqual(
      first.status === "ready" && first.session.missions,
    );

    expect(after.missions).toStrictEqual(before.missions);
    expect(after.startedAt).toBeNull();
    expect(after.status).toBe("planned");
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });

  it("keeps a seeded pronunciation pick through due-word reads and an unstarted return to Today", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const input = await languageGoalFixture();
    await learningProfileFixture({ activeGoalId: input.goal.id, userId: input.user.id });
    mockSession(input.user.id);
    const empty = await getPronunciationReviews({ goalId: input.goal.id });
    expect(empty.status === "ready" && empty.reviews.words).toStrictEqual([]);
    const first = await getTodayStudySession({ goalId: input.goal.id, timeZone: "UTC" });
    expect(first.status).toBe("ready");

    if (first.status !== "ready") {
      throw new Error("Expected the language learner's Today session");
    }

    const organization = await organizationFixture();
    const word = await wordFixture({ organizationId: organization.id, targetLanguage: "en" });
    await pronunciationReviewFixture({ dueAt: new Date(), userId: input.user.id, wordId: word.id });

    const missions = {
      picks: [{ anchor: {}, kind: "pronunciation", opens: { kind: "pronunciation" }, total: 1 }],
      version: 1,
    };

    await prisma.studySession.update({ data: { missions }, where: { id: first.session.id } });
    const before = await getTodayStudySession({ goalId: input.goal.id, timeZone: "UTC" });
    const due = await getPronunciationReviews({ goalId: input.goal.id });
    expect(due.status === "ready" ? due.reviews.words.length : 0).toBe(1);

    vi.setSystemTime(new Date("2026-10-13T10:01:00Z"));
    const after = await getTodayStudySession({ goalId: input.goal.id, timeZone: "UTC" });
    const stored = await prisma.studySession.findUniqueOrThrow({ where: { id: first.session.id } });

    expect(after.status === "ready" && after.session.missions).toStrictEqual(
      before.status === "ready" && before.session.missions,
    );

    expect(after.status === "ready" && after.session.missions).toMatchObject([
      { kind: "pronunciation", status: "todo" },
    ]);

    expect(stored.missions).toStrictEqual(missions);
    expect(stored.startedAt).toBeNull();
    await expect(prisma.usageRecord.count({ where: { userId: input.user.id } })).resolves.toBe(0);
  });

  it("keeps eligible saved targets when an unstarted queue is rebuilt with more lessons", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const { goal, item, session, user } = await buildDay();
    const before = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    const added = await libraryLessonFixture({ estimatedMinutes: 4 });

    await planItemFixture({
      lessonId: added.id,
      planId: item.planId,
      scheduledFor: session.localDate,
    });

    const refresh = await followPlanChangeToday({
      goalId: goal.id,
      localDate: session.localDate,
      timeZone: "UTC",
      userId: user.id,
    });

    const after = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true },
      where: { id: session.id },
    });

    expect(refresh).toBe("rebuilt");
    expect(after.blocks.map((block) => block.lessonId)).toContain(added.id);
    expect(after.blocks.length).toBeGreaterThan(session.blocks.length);
    expect(after.startedAt).toBeNull();
    expect(after.missions).toStrictEqual(before.missions);
  });

  it("replaces impossible targets with fitting work when no saved target survives a rebuild", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const { goal, item, session, user } = await buildDay();
    const replacement = await libraryLessonFixture({ estimatedMinutes: 4 });

    await prisma.planItem.delete({ where: { id: item.id } });

    const replacementItem = await planItemFixture({
      lessonId: replacement.id,
      planId: item.planId,
      scheduledFor: session.localDate,
    });

    const refresh = await followPlanChangeToday({
      goalId: goal.id,
      localDate: session.localDate,
      timeZone: "UTC",
      userId: user.id,
    });

    const after = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    expect(refresh).toBe("rebuilt");
    expect(after.status === "ready" ? after.session.missions.length : 0).toBeGreaterThan(0);

    expect(
      after.status === "ready" && after.session.blocks.map((block) => block.lessonId),
    ).toContain(replacement.id);

    const stored = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });

    expect(stored.missions).toMatchObject({
      picks: [{ anchor: { lessonIds: [replacement.id], planItemIds: [replacementItem.id] } }],
    });
  });

  it("keeps completed picks after their block is removed and uses them in the summary", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const { session, user } = await buildDay();

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { sessionId: session.id },
    });

    await settleMissions({ sessionId: session.id, timeZone: "UTC", userId: user.id });
    await prisma.studySessionBlock.deleteMany({ where: { sessionId: session.id } });

    const [view, summary] = await Promise.all([
      getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id }),
      getStudySessionSummary({ input: { timeZone: "UTC" }, sessionId: session.id }),
    ]);

    expect(view.status === "ready" && view.session.missions).toMatchObject([
      { done: 1, kind: "somethingNew", status: "done", total: 1 },
    ]);

    expect(summary.status === "ready" && summary.summary.missions).toStrictEqual(
      view.status === "ready" && view.session.missions,
    );
  });

  it("writes picks at build and never adds a mission when later work lands", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const { session, user } = await buildDay();
    const stored = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(stored).toHaveProperty("missions", expect.objectContaining({ version: 1 }));
    const before = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    await studySessionBlockFixture({
      kind: "review",
      payload: toBlockPayload({}),
      sessionId: session.id,
    });

    const after = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    expect(after.status === "ready" && after.session.missions).toStrictEqual(
      before.status === "ready" && before.session.missions,
    );

    const again = await ensureStudySession({
      goal: await prisma.goal.findFirstOrThrow({ where: { userId: user.id } }),
      localDate: session.localDate,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(again).toHaveProperty("missions", expect.objectContaining({ version: 1 }));
  });

  it("drops removed unfinished anchors without replacing them", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    const { session } = await buildDay();
    const before = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

    expect(
      before.status === "ready" &&
        before.session.missions.some((mission) => mission.kind === "somethingNew"),
    ).toBe(true);

    await prisma.studySessionBlock.deleteMany({ where: { kind: "learn", sessionId: session.id } });
    await studySessionBlockFixture({ kind: "review", sessionId: session.id });
    const after = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });
    expect(after.status === "ready" && after.session.missions).toStrictEqual([]);
  });

  it("keeps Today and buddy on the same running session across midnight", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T23:50:00Z"));
    const { goal, session } = await buildDay();

    await prisma.studySession.update({
      data: { startedAt: new Date(), status: "active" },
      where: { id: session.id },
    });

    await prisma.studySessionBlock.updateMany({
      data: { startedAt: new Date(), status: "active" },
      where: { sessionId: session.id },
    });

    vi.setSystemTime(new Date("2026-10-14T00:05:00Z"));

    const [today, buddy] = await Promise.all([
      getTodayStudySession({ goalId: goal.id, timeZone: "UTC" }),
      getBuddyStatus({ timeZone: "UTC" }),
    ]);

    expect(today.status === "ready" && today.session.id).toBe(session.id);

    expect(buddy).toMatchObject({
      buddy: { today: { missions: today.status === "ready" ? today.session.missions : [] } },
      status: "ready",
    });
  });
});
