import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { toBlockPayload } from "../block-payload";
import { loadDayMissionFacts } from "./day-facts";
import { getDayMissions } from "./get-day-missions";

const now = new Date("2026-10-13T12:00:00Z");
const localDate = new Date("2026-10-13T00:00:00Z");
const learnedAt = new Date("2026-10-01T12:00:00Z");

async function fixture() {
  const [user, skill, chapter] = await Promise.all([
    userFixture(),
    skillFixture(),
    libraryChapterFixture(),
  ]);

  const goal = await goalFixture({ dailyMinutes: 30, userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  await planItemFixture({ chapterId: chapter.id, planId: plan.id, skillId: skill.id });

  await Promise.all([
    attemptFixture({ answeredAt: learnedAt, skillId: skill.id, userId: user.id }),
    learnerSkillFixture({
      lastReviewedAt: learnedAt,
      reps: 1,
      skillId: skill.id,
      stability: 0.5,
      state: "learning",
      userId: user.id,
    }),
  ]);

  return { chapter, goal, skill, userId: user.id };
}

function load(
  input: Awaited<ReturnType<typeof fixture>>,
  { extra = false, plannedMinutes = 30, skillIds = [input.skill.id] } = {},
) {
  return loadDayMissionFacts({
    blocks: [
      {
        canDo: null,
        estimatedMinutes: 10,
        kind: "practice",
        lessonId: null,
        payload: toBlockPayload({ extra, skillIds }),
      },
    ],
    goal: input.goal,
    localDate,
    now,
    plannedMinutes,
    timeZone: "UTC",
    userId: input.userId,
  });
}

describe("weak-area missions stay inside the existing planned practice", () => {
  it("drops an unfinished pick when a plan change replaces practice with unrelated skills", async () => {
    const input = await fixture();
    const facts = await load(input);
    const pick = facts.candidates.find((candidate) => candidate.kind === "weakSpot");

    if (!pick) {
      throw new Error("The studied weak area should have a mission candidate.");
    }

    const session = await studySessionFixture({
      goalId: input.goal.id,
      localDate,
      missions: { picks: [pick], version: 1 },
      startedAt: now,
      userId: input.userId,
    });

    const practice = await studySessionBlockFixture({
      kind: "practice",
      payload: toBlockPayload({ skillIds: [input.skill.id] }),
      sessionId: session.id,
    });

    const unrelated = await skillFixture();

    await prisma.studySessionBlock.update({
      data: { payload: toBlockPayload({ skillIds: [unrelated.id] }), status: "completed" },
      where: { id: practice.id },
    });

    const current = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true, goal: true },
      where: { id: session.id },
    });

    const missions = await getDayMissions({ session: current, timeZone: "UTC" });
    expect(missions).toStrictEqual([]);
  });

  it("anchors the weakest studied area to its planned practice without adding time or claiming usage", async () => {
    const input = await fixture();
    const facts = await load(input);
    const pick = facts.candidates.find((candidate) => candidate.kind === "weakSpot");

    expect(pick).toMatchObject({
      anchor: { areaId: input.chapter.id, blockKind: "practice" },
      detail: { minutes: 10 },
    });

    expect(pick?.opens?.kind).not.toBe("areaPractice");
    expect(facts.plannedMinutes).toBe(30);
    await expect(prisma.usageRecord.count({ where: { userId: input.userId } })).resolves.toBe(0);
  });

  it.each([{ extra: true }, { plannedMinutes: 20 }, { skillIds: [] }])(
    "omits extra, small or unrelated practice: %j",
    async (options) => {
      const facts = await load(await fixture(), options);
      expect(facts.candidates.some((pick) => pick.kind === "weakSpot")).toBe(false);
    },
  );
});
