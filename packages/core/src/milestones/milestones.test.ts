import { prisma } from "@zoonk/db";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { awardMilestones } from "./award-milestones";
import { getBuddyStatus } from "./get-buddy-status";
import { getWeeklyRecap } from "./get-weekly-recap";
import { listCurrentUserMilestones, markMilestoneShown } from "./list-milestones";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Sunday, Oct 4: the logbook for Sep 28 to Oct 4 is ready. */
const SUNDAY = new Date("2026-10-04T18:00:00Z");
const MONDAY = new Date("2026-09-28T00:00:00Z");

function weekDay(offset: number, hour = 10) {
  return new Date(MONDAY.getTime() + offset * 86_400_000 + hour * 3_600_000);
}

describe(awardMilestones, () => {
  it("awards glasses from the ledger and belts crossed now, each once", async () => {
    const user = await userFixture();

    await Promise.all([
      learningProfileFixture({ buddyKind: "zu", userId: user.id }),
      learningEventFixture({
        correctAnswers: 8,
        incorrectAnswers: 2,
        kind: "checkpoint",
        lessonKind: "boss",
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 3,
        incorrectAnswers: 7,
        kind: "checkpoint",
        lessonKind: "boss",
        userId: user.id,
      }),
    ]);

    const first = await awardMilestones({
      brainPower: { after: 7600, before: 7400 },
      userId: user.id,
    });

    expect(
      first
        .map((milestone) => `${milestone.kind}:${milestone.key}`)
        .toSorted((a, b) => a.localeCompare(b)),
    ).toStrictEqual(["belt:orange", "buddyStage:young", "glasses:star"]);

    await expect(
      awardMilestones({ brainPower: { after: 7600, before: 7400 }, userId: user.id }),
    ).resolves.toStrictEqual([]);
  });
});

describe(listCurrentUserMilestones, () => {
  it("lists glasses with progress and the one ceremony to show, which shows only once", async () => {
    const user = await userFixture();

    const [badge, stage] = await Promise.all([
      milestoneFixture({ kind: "badge", userId: user.id }),
      milestoneFixture({ key: "young", kind: "buddyStage", userId: user.id }),
      ...Array.from({ length: 3 }, () =>
        learningEventFixture({ kind: "review", lessonKind: "capsule", userId: user.id }),
      ),
    ]);

    mockSession(user.id);
    const listed = await listCurrentUserMilestones();

    expect(listed.status === "ready" && listed.milestones.ceremony?.id).toBe(stage.id);

    expect(
      listed.status === "ready" &&
        listed.milestones.glasses.find((glasses) => glasses.glasses === "retro"),
    ).toStrictEqual({ current: 3, earned: false, glasses: "retro", target: 50 });

    await expect(markMilestoneShown(stage.id)).resolves.toMatchObject({
      milestone: { id: stage.id },
      status: "ready",
    });

    const after = await listCurrentUserMilestones();
    expect(after.status === "ready" && after.milestones.ceremony?.id).toBe(badge.id);

    const stranger = await userFixture();
    mockSession(stranger.id);
    await expect(markMilestoneShown(badge.id)).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe(getWeeklyRecap, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tells the week against the learner's own last week, with its biggest turnaround", async () => {
    const user = await userFixture();
    const skill = await skillFixture({ name: "Proportions" });

    await Promise.all([
      dailyProgressFixtureMany([
        {
          correctAnswers: 20,
          date: weekDay(0, 0),
          incorrectAnswers: 5,
          timeSpentSeconds: 2700,
          userId: user.id,
        },
        {
          correctAnswers: 10,
          date: weekDay(2, 0),
          incorrectAnswers: 2,
          timeSpentSeconds: 1500,
          userId: user.id,
        },
        {
          correctAnswers: 5,
          date: weekDay(-3, 0),
          incorrectAnswers: 5,
          timeSpentSeconds: 1800,
          userId: user.id,
        },
      ]),
      learnerSkillFixture({
        recallDays: 3,
        reps: 5,
        skillId: skill.id,
        state: "mastered",
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: weekDay(0),
        isCorrect: false,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: weekDay(0, 11),
        isCorrect: true,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: weekDay(0, 12),
        isCorrect: false,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: weekDay(2),
        isCorrect: true,
        skillId: skill.id,
        userId: user.id,
      }),
      attemptFixture({
        answeredAt: weekDay(5),
        isCorrect: true,
        skillId: skill.id,
        userId: user.id,
      }),
      milestoneFixture({ earnedAt: weekDay(3), key: "trapHunter:boss", userId: user.id }),
      mistakeFixture({ fixedAt: weekDay(4), status: "fixed", userId: user.id }),
    ]);

    mockSession(user.id);
    const result = await getWeeklyRecap({ timeZone: "UTC" });

    if (result.status !== "ready") {
      throw new Error("Expected a recap");
    }

    expect(result.recap).toMatchObject({
      buddyAte: { fixes: 1 },
      comparison: { days: 1, minutes: 40, questions: 27 },
      ready: true,
      week: { averageMinutes: 35, minutes: 70, questions: 37 },
      weekEnd: new Date("2026-10-04T00:00:00Z"),
      weekStart: MONDAY,
    });

    expect(result.recap.turnaround).toMatchObject({
      name: "Proportions",
      reason: "gold",
      rememberedOn: [new Date("2026-09-30T00:00:00Z"), new Date("2026-10-03T00:00:00Z")],
      to: 1,
    });

    expect(result.recap.badges.map((badge) => badge.key)).toStrictEqual(["trapHunter:boss"]);
  });
});

describe(getBuddyStatus, () => {
  it("shows the buddy's Energy, how far the next stage is and the glasses", async () => {
    const user = await userFixture();

    await Promise.all([
      learningProfileFixture({ buddyKind: "zu", buddyName: "Zu", userId: user.id }),
      userProgressFixture({ currentEnergy: 12, totalBrainPower: 4550n, userId: user.id }),
    ]);

    mockSession(user.id);
    const result = await getBuddyStatus({ timeZone: "UTC" });

    expect(result).toMatchObject({
      buddy: {
        belt: { color: "yellow", level: 5, totalBrainPower: 4550 },
        buddy: { glasses: "round", kind: "zu", name: "Zu" },
        energy: { current: 12, state: "napping", studiedToday: false },
        nextStage: { belt: "orange", brainPowerToGo: 2950, stage: "young" },
        stage: "baby",
      },
      status: "ready",
    });

    await prisma.dailyProgress.create({
      data: {
        date: new Date(new Date().toISOString().slice(0, 10)),
        dayOfWeek: 0,
        timeSpentSeconds: 300,
        userId: user.id,
      },
    });

    const awake = await getBuddyStatus({ timeZone: "UTC" });
    expect(awake.status === "ready" && awake.buddy.energy.state).toBe("awake");
  });
});
