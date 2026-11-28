import { checkMemberCoverage } from "@zoonk/ai/tasks/curriculum/member-coverage";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { memberCheckWorkflow } from "./member-check-workflow";

const GENERAL_GOAL = "Learn the steps of a process";

/** A goal whose two skills teach members 1 and 3 of its list, owned by its learner when `own`. */
async function owedPlan({ own }: { own: boolean }) {
  const user = await userFixture();
  const ownerId = own ? user.id : null;

  const [first, third] = await Promise.all([
    skillFixture({ name: `First step ${crypto.randomUUID()}`, ownerId }),
    skillFixture({ name: `Third step ${crypto.randomUUID()}`, ownerId }),
  ]);

  const goal = await goalFixture({
    prompt: `Learn the steps my teacher Ana gave me ${crypto.randomUUID()}`,
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: { skills: plannedSkills([first, third]) },
  });

  const name = `Do the second step ${crypto.randomUUID().slice(0, 8)}`;

  vi.mocked(checkMemberCoverage).mockResolvedValue(
    taskResult(
      {
        members: [
          { name: "First", number: 1, skills: ["s1"] },
          { name: "Second", number: 2, skills: [] },
          { name: "Third", number: 3, skills: ["s2"] },
        ],
        reason: "Your plan left out the second step.",
        set: "Steps",
        uncovered: [{ description: "Do the second step.", member: "Second", name, number: 2 }],
      },
      "anthropic/claude-haiku-5.5",
    ),
  );

  return { goal, name, plan, user };
}

describe(memberCheckWorkflow, () => {
  beforeEach(() => {
    vi.mocked(classifyGoalSpecificity).mockResolvedValue(
      taskResult({ generalGoal: GENERAL_GOAL, personalDetails: [], privateCourse: false }),
    );

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
  });

  it("checks a shared plan by its general goal and adds the member to the shared Library", async () => {
    const { goal, name, plan } = await owedPlan({ own: false });

    await expect(memberCheckWorkflow({ planId: plan.id })).resolves.toBe(1);

    expect(checkMemberCoverage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: expect.objectContaining({ contentScope: "shared", goalId: goal.id }),
        goal: GENERAL_GOAL,
      }),
    );

    await expect(prisma.skill.findFirst({ where: { name } })).resolves.toMatchObject({
      ownerId: null,
    });
  });

  it("keeps the member of a learner's own plan theirs, never asking whether it could be shared", async () => {
    const { goal, name, plan, user } = await owedPlan({ own: true });

    await expect(memberCheckWorkflow({ planId: plan.id })).resolves.toBe(1);

    expect(classifyGoalSpecificity).not.toHaveBeenCalled();

    expect(checkMemberCoverage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: expect.objectContaining({ contentScope: "personal" }),
        goal: goal.prompt,
      }),
    );

    await expect(prisma.skill.findFirst({ where: { name } })).resolves.toMatchObject({
      ownerId: user.id,
    });
  });
});
