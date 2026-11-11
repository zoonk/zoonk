import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it } from "vitest";
import { PLAN_SHOWN, examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { loadPlacementPlan } from "../_utils/goal-skill-graph";
import { readCurrentTestSummary } from "../facts/focus-test-summary";
import { pickSessionPlacementItems } from "./_utils/session-placement-items";
import { settleFocusTestAfterSession } from "./_utils/settle-focus-test";

const SUBJECTS = [
  { name: "Português", questions: 8 },
  { name: "Direito Administrativo", questions: 12 },
  { name: "Informática", questions: 4 },
];

async function setup({ inferred = false }: { inferred?: boolean } = {}) {
  const fixture = await examTestGoalFixture({ goal: PLAN_SHOWN, subjects: SUBJECTS });
  const { goal, items, subjectOf, user } = fixture;
  const asked = items.find((item) => subjectOf(item.skillId) === "Direito Administrativo");

  if (inferred) {
    await skillPrerequisiteFixture({
      prerequisiteId: asked?.skillId ?? "",
      skillId: fixture.skills.find((skill) => skill.area === "Português")?.id ?? "",
    });
  }

  // A sitting's answer: the heaviest subject is the only one asked so far.
  await attemptFixture({
    ...(inferred && { answer: { dontKnow: true }, isCorrect: false }),
    isPlacement: true,
    itemId: asked?.id ?? "",
    skillId: asked?.skillId ?? "",
    userId: user.id,
  });

  const plan = await loadPlacementPlan(goal.id);

  const pick = async (unaskedOnly: boolean) => {
    const picked = await pickSessionPlacementItems({
      excludeItemIds: new Set(),
      goal,
      limit: 3,
      quickFormat: "multipleChoice",
      skills: plan.skills,
      test: {
        areaOf: new Map(plan.skills.map((skill) => [skill.id, skill.sectionTitle ?? ""])),
        subjects: SUBJECTS.map(({ name, questions }) => ({
          areas: [name],
          key: name,
          minimumScore: false,
          name,
          part: null,
          share: questions / 24,
          shortName: null,
        })),
        unaskedOnly,
      },
      userId: user.id,
    });

    return picked.map((itemId) => subjectOf(items.find((item) => item.id === itemId)?.skillId));
  };

  return { ...fixture, pick };
}

describe("the Focus test's questions inside sessions", () => {
  it("asks the subjects with no test answer first through the first week, and only them after it", async () => {
    const { pick } = await setup();

    const firstWeek = await pick(false);
    const later = await pick(true);

    expect(firstWeek).toHaveLength(3);
    expect(firstWeek.at(-1)).toBe("Direito Administrativo");
    expect(new Set(later)).toStrictEqual(new Set(["Informática", "Português"]));
  });

  it("asks an unasked subject whose starting point was inferred from another subject", async () => {
    const { pick } = await setup({ inferred: true });

    await expect(pick(true)).resolves.toContain("Português");
  });

  it("reads session coverage from answers before and after settlement", async () => {
    const { goal, items, user } = await setup();

    const [asking, plain] = await Promise.all([
      studySessionFixture({ goalId: goal.id, localDate: new Date("2030-01-05"), userId: user.id }),
      studySessionFixture({ goalId: goal.id, localDate: new Date("2030-01-06"), userId: user.id }),
    ]);

    const readSummary = () => readCurrentTestSummary(user.id, goal.id);

    await settleFocusTestAfterSession({ goalId: goal.id, sessionId: plain.id, userId: user.id });
    await expect(readSummary()).resolves.toMatchObject({ asked: 1 });

    await attemptFixture({
      isPlacement: true,
      itemId: items[0]?.id ?? "",
      skillId: items[0]?.skillId ?? "",
      studySessionId: asking.id,
      userId: user.id,
    });

    await settleFocusTestAfterSession({ goalId: goal.id, sessionId: asking.id, userId: user.id });

    await expect(readSummary()).resolves.toMatchObject({
      asked: 2,
      offerQuestions: 10,
      total: 3,
      unasked: 1,
    });
  });
});
