import { checkMemberCoverage } from "@zoonk/ai/tasks/curriculum/member-coverage";
import { prisma } from "@zoonk/db";
import { goalSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { createGoalPlan } from "./create-goal-plan";
import {
  MEMBER_CHECK_SOURCE,
  checkPlanMembers,
  claimMemberCheck,
  listPlansOwingMemberCheck,
  offerMemberSkills,
  toMemberSkills,
} from "./plan-member-check";

const NOW = new Date("2020-09-28T12:00:00Z");

type Coverage = Awaited<ReturnType<typeof checkMemberCoverage>>["data"];

async function plannedGoal(
  attrs: Pick<Parameters<typeof unplannedGoalFixture>[0], "kind" | "status"> = {},
) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [{ lessons: 2 }, { lessons: 3 }, { lessons: 4 }],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
    ...attrs,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  return { goal, library, plan, user };
}

function mockCoverage(data: Coverage) {
  vi.mocked(checkMemberCoverage).mockResolvedValue({
    data,
    provenance: {
      generatedAt: NOW.toISOString(),
      latencyMs: 1,
      model: "anthropic/claude-haiku-5.5",
      promptVersion: "test",
      provider: "anthropic",
      requestedModel: "anthropic/claude-haiku-5.5",
      runId: "run-member-coverage",
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

/** The plan's skills `s1` to `s3` teach members 1, 3 and 4 of a list; member 2 has none. */
function listMissingSecond(name: string): Coverage {
  return {
    members: [
      { name: "First", number: 1, skills: ["s1"] },
      { name: "Second", number: 2, skills: [] },
      { name: "Third", number: 3, skills: ["s2"] },
      { name: "Fourth", number: 4, skills: ["s3"] },
    ],
    reason: "Your plan covered every step except the second.",
    set: "Steps",
    uncovered: [{ description: "Do the second step.", member: "Second", name, number: 2 }],
  };
}

async function runCheck(planId: string) {
  const claimed = await claimMemberCheck(planId);

  if (!claimed) {
    throw new Error("Expected the check to be claimed");
  }

  const check = await checkPlanMembers(claimed);
  const skills = await toMemberSkills({ check, claimed });
  await offerMemberSkills({ check, claimed, skills });

  return { check, claimed, skills };
}

describe(listPlansOwingMemberCheck, () => {
  it("lists active learn plans with a graph whose check is still owed", async () => {
    const owed = await plannedGoal();
    const checked = await plannedGoal();
    const exam = await plannedGoal({ kind: "exam" });
    const paused = await plannedGoal({ status: "paused" });
    const material = await plannedGoal();
    const learner = await userFixture();
    const empty = await unplannedGoalFixture({ userId: learner.id });

    await prisma.plan.update({ data: { membersCheckedAt: NOW }, where: { id: checked.plan.id } });
    const notes = await sourceFixture({ extractedText: "Page 1", title: "Notes" });
    await goalSourceFixture({ goalId: material.goal.id, sourceId: notes.id });

    const listed = await listPlansOwingMemberCheck();

    expect(listed).toContain(owed.plan.id);

    for (const left of [checked, exam, paused, material, empty]) {
      expect(listed).not.toContain(left.plan.id);
    }
  });
});

describe(claimMemberCheck, () => {
  it("claims a plan's check once, marking it before anything is spent", async () => {
    const { goal, library, plan } = await plannedGoal();

    const claimed = await claimMemberCheck(plan.id);

    expect(claimed?.goalId).toBe(goal.id);

    expect(claimed?.skills.map((skill) => skill.skillId)).toStrictEqual(
      library.skills.map((skill) => skill.id),
    );

    await expect(claimMemberCheck(plan.id)).resolves.toBeNull();

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      membersCheckedAt: expect.any(Date),
    });
  });
});

describe(offerMemberSkills, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the learner to add the member their plan leaves out, between its neighbors", async () => {
    const { library, plan } = await plannedGoal();
    const name = `Do the second step ${uniqueWord()}`;
    mockCoverage(listMissingSecond(name));

    const { skills } = await runCheck(plan.id);
    const second = library.skills[1];

    expect(vi.mocked(checkMemberCoverage).mock.lastCall?.[0]).toMatchObject({
      analytics: { contentScope: "personal" },
      serviceTier: "flex",
      skills: library.skills.map((skill, index) => ({ key: `s${index + 1}`, name: skill.name })),
    });

    expect(skills).toStrictEqual([
      expect.objectContaining({ beforeSkillId: second?.id, lessons: 2, name }),
    ]);

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });
    const proposed = changes.filter((change) => change.status === "proposed");

    expect(proposed).toHaveLength(1);
    expect(proposed[0]?.reason).toBe("Your plan covered every step except the second.");
    expect(parsePlanChangePayload(proposed[0]?.payload).source).toBe(MEMBER_CHECK_SOURCE);
  });

  it("anchors a member after the plan's last skill just before that skill", async () => {
    const { library, plan } = await plannedGoal();
    const name = `Do the last step ${uniqueWord()}`;

    mockCoverage({
      members: [
        { name: "First", number: 1, skills: ["s1"] },
        { name: "Second", number: 2, skills: ["s2"] },
        { name: "Third", number: 3, skills: ["s3"] },
        { name: "Fourth", number: 4, skills: [] },
      ],
      reason: "Your plan left out the last step.",
      set: "Steps",
      uncovered: [{ description: "Do the last step.", member: "Fourth", name, number: 4 }],
    });

    const { skills } = await runCheck(plan.id);

    expect(skills).toStrictEqual([
      expect.objectContaining({ beforeSkillId: library.skills[2]?.id, lessons: 4, name }),
    ]);
  });

  it("offers nothing and keeps the plan marked when every member is taught", async () => {
    const { plan } = await plannedGoal();

    mockCoverage({
      members: [{ name: "First", number: 1, skills: ["s1"] }],
      reason: null,
      set: "Steps",
      uncovered: [],
    });

    const { skills } = await runCheck(plan.id);

    expect(skills).toStrictEqual([]);

    await expect(
      prisma.planChange.count({ where: { planId: plan.id, status: "proposed" } }),
    ).resolves.toBe(0);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      membersCheckedAt: expect.any(Date),
    });
  });
});
