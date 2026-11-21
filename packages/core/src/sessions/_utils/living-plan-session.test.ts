import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type GoalPlan } from "../../learner/_utils/goal-skill-graph";
import { loadLivingPlanSignals, planSignals } from "./living-plan-session";
import { type ClosedLivingPlanWindow } from "./living-plan-window";

const FIRST = new Date("2026-11-19T13:00:00Z");
const NEXT = new Date("2026-11-20T00:00:00Z");
const LATER = new Date("2026-11-21T00:00:00Z");

function item(skillId: string, status: GoalPlan["items"][number]["status"]) {
  return { chapterId: null, id: skillId, skillIds: [skillId], status };
}

const goalPlan = {
  items: [
    item("skipped", "testedOut"),
    item("studied", "done"),
    item("unrelated", "testedOut"),
    item("later", "todo"),
    item("next", "todo"),
    item("removed", "todo"),
  ],
  skills: ["skipped", "studied", "unrelated", "later", "next", "removed"].map((id, order) => ({
    areaId: "area",
    areaTitle: "",
    band: null,
    foundation: false,
    id,
    memberSkillIds: [],
    order,
    phase: 0,
    prerequisiteIds: [],
    removed: id === "removed",
    sectionTitle: null,
  })),
} satisfies GoalPlan;

const prerequisites = new Map([
  ["next", ["skipped", "studied"]],
  ["skipped", ["unrelated"]],
]);

const easy = {
  at: FIRST.toISOString(),
  missedSkillIds: [],
  result: "easy",
  streak: 1,
} satisfies ClosedLivingPlanWindow;

const hard = {
  at: FIRST.toISOString(),
  missedSkillIds: ["next"],
  result: "hard",
  streak: 1,
} satisfies ClosedLivingPlanWindow;

function window(closed: ClosedLivingPlanWindow) {
  return { closed, correct: 0, missedSkillIds: [], total: 0 };
}

describe(planSignals, () => {
  it("checks next topics in plan order and uses only direct prerequisites of hard lessons", () => {
    expect(planSignals({ plan: goalPlan, prerequisites, windows: [easy, hard] })).toStrictEqual({
      earlyReviewSkillIds: ["studied"],
      easySkillIds: ["later", "next"],
      hardRecheckSkillIds: ["skipped"],
    });
  });
});

describe(loadLivingPlanSignals, () => {
  it("reads the learn goal's own signal on the next session day once", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      livingPlanWindow: window({
        ...hard,
        at: "2026-11-20T00:05:00.000Z",
        sessionDay: "2026-11-19",
      }),
      userId: user.id,
    });

    const load = (localDate: Date, previousSessionDate: Date | null) =>
      loadLivingPlanSignals({
        goal,
        localDate,
        plan: { goalPlan, prerequisites, previousSessionDate },
        timeZone: "UTC",
      });

    const [same, next, later] = await Promise.all([
      load(new Date("2026-11-19T00:00:00Z"), null),
      load(NEXT, null),
      load(LATER, NEXT),
    ]);

    expect(same.hardRecheckSkillIds).toStrictEqual([]);
    expect(next.hardRecheckSkillIds).toStrictEqual(["skipped"]);
    expect(later.hardRecheckSkillIds).toStrictEqual([]);
  });

  it("loads independent language skill signals for the goal's language", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "language", targetLanguage: "fr", userId: user.id });

    await prisma.languageSkillLevel.createMany({
      data: [
        {
          language: "fr",
          livingPlanWindow: window(easy),
          score: 0,
          skill: "reading",
          startScore: 0,
          userId: user.id,
        },
        {
          language: "fr",
          livingPlanWindow: window(hard),
          score: 0,
          skill: "listening",
          startScore: 0,
          userId: user.id,
        },
        {
          language: "es",
          livingPlanWindow: window({ ...hard, missedSkillIds: ["skipped"] }),
          score: 0,
          skill: "reading",
          startScore: 0,
          userId: user.id,
        },
      ],
    });

    await expect(
      loadLivingPlanSignals({
        goal,
        localDate: NEXT,
        plan: { goalPlan, prerequisites, previousSessionDate: null },
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({
      earlyReviewSkillIds: ["studied"],
      easySkillIds: ["later", "next"],
      hardRecheckSkillIds: ["skipped"],
    });
  });
});
