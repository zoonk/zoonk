import { type CourseLevel, type Skill, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { listeningBlueprintFixture } from "@zoonk/testing/fixtures/listening";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { placementItemBank } from "../learner/_test-utils/placement-tap-items";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { finishGoalPlacement } from "../learner/placement/finish-goal-placement";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { markPlanInputsUntil } from "./_test-utils/mark-plan-inputs";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { settleNewPlan } from "./_utils/recommended-bases";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";

async function settledLearner(
  details: { knownSubjects?: string[]; level: OwnLevel | null },
  duringBurst = false,
) {
  const user = await userFixture();

  const [library, blueprint] = await Promise.all([
    planLibraryFixture({
      phases: ["Basics", "Deeper"],
      skills: [
        { area: "Listening", lessons: 2, phase: 0 },
        { area: "Listening", lessons: 2, phase: 0 },
        { area: "Listening", builds: 0, lessons: 2, phase: 1 },
        { area: "Listening", builds: 1, lessons: 2, phase: 1 },
        { area: "Reading", lessons: 2, phase: 0 },
        { area: "Reading", builds: 4, lessons: 2, phase: 1 },
      ],
    }),
    listeningBlueprintFixture({ name: `IELTS ${crypto.randomUUID()}` }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    details,
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "en",
    settings: { startDate: "2026-10-12" },
    targetLanguage: "en",
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  const stop = new AbortController();

  if (!duringBurst) {
    stop.abort();
  }

  const marking = markPlanInputsUntil({ planId: plan.id, signal: stop.signal });

  let marks = 0;

  try {
    await settleNewPlan({ goalId: goal.id });
  } finally {
    stop.abort();
    marks = await marking;
  }

  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  const todo = (skill: Skill | undefined) =>
    prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, skillId: skill?.id, status: "todo" },
    });

  return {
    goal,
    marks,
    settings: parsePlanSettings(saved.settings),
    skills: library.skills,
    todo,
    user,
  };
}

describe("a language exam's listening basics at the learner's own level", () => {
  it("keeps the inferred starts as inputs when background marks win the layout save", async () => {
    const { marks, settings } = await settledLearner({ level: "intermediate" }, true);
    expect(marks).toBeGreaterThan(1);
    expect(settings.pastBasicsAreas).toStrictEqual(["Listening"]);
  });

  it("start past the basics for a learner who studied the language before, still to confirm", async () => {
    const { goal, settings, skills, todo, user } = await settledLearner({ level: "intermediate" });
    const [sounds, exchanges, details, gist, words] = skills;

    expect(settings.pastBasicsAreas).toStrictEqual(["Listening"]);

    await expect(Promise.all([todo(sounds), todo(exchanges)])).resolves.toStrictEqual([0, 0]);

    await expect(Promise.all([todo(details), todo(gist), todo(words)])).resolves.toStrictEqual([
      2, 2, 2,
    ]);

    const basics = [sounds?.id ?? "", exchanges?.id ?? ""];

    await expect(
      loadSkillsToConfirm({ goalId: goal.id, skillIds: basics, userId: user.id }),
    ).resolves.toStrictEqual(new Set(basics));
  });

  it("start past the basics when the learner says they know Listening well", async () => {
    const { settings, skills, todo } = await settledLearner({
      knownSubjects: ["Listening"],
      level: null,
    });

    const [sounds, exchanges] = skills;

    expect(settings.pastBasicsAreas).toStrictEqual(["Listening"]);
    await expect(Promise.all([todo(sounds), todo(exchanges)])).resolves.toStrictEqual([0, 0]);
  });

  it("stay for a learner who knows only Reading well", async () => {
    const { settings } = await settledLearner({ knownSubjects: ["Reading"], level: null });
    expect(settings.pastBasicsAreas).toStrictEqual([]);
  });

  it("stay for a learner who knows a little", async () => {
    const { settings, skills, todo } = await settledLearner({ level: "basic" });
    const [sounds, exchanges] = skills;

    expect(settings.pastBasicsAreas).toStrictEqual([]);
    await expect(Promise.all([todo(sounds), todo(exchanges)])).resolves.toStrictEqual([2, 2]);
  });
});

async function placedLearner({
  listeningLevel,
  readingRight,
}: {
  listeningLevel: CourseLevel;
  readingRight: [boolean, boolean];
}) {
  const user = await userFixture();

  const [library, blueprint] = await Promise.all([
    planLibraryFixture({
      phases: ["Basics", "Deeper"],
      skills: [
        { area: "Listening", lessons: 2, level: listeningLevel, phase: 0 },
        { area: "Listening", lessons: 2, level: listeningLevel, phase: 0 },
        { area: "Listening", builds: 0, lessons: 2, level: "intermediate", phase: 1 },
        { area: "Listening", builds: 1, lessons: 2, level: "intermediate", phase: 1 },
        { area: "Reading", lessons: 2, level: "beginner", phase: 0 },
        { area: "Reading", lessons: 2, level: "beginner", phase: 0 },
        { area: "Reading", builds: 4, lessons: 2, level: "intermediate", phase: 1 },
        { area: "Reading", builds: 5, lessons: 2, level: "intermediate", phase: 1 },
      ],
    }),
    listeningBlueprintFixture({ name: `DELE ${crypto.randomUUID()}` }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 60,
    details: { level: null },
    examBlueprintId: blueprint.id,
    kind: "exam",
    language: "pt",
    settings: { startDate: "2026-10-12" },
    targetLanguage: "es",
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const reading = library.skills.slice(4, 6);

  const banks = await placementItemBank(reading.map((skill) => skill.id));

  await Promise.all(
    banks.flatMap((bank, index) =>
      bank.map(({ answer, item }) =>
        attemptFixture({
          answer: readingRight[index] ? answer : { dontKnow: true },
          isCorrect: readingRight[index] ?? false,
          itemId: item.id,
          skillId: item.skillId,
          userId: user.id,
        }),
      ),
    ),
  );

  const finished = await finishGoalPlacement({ goalId: goal.id, input: {} });
  await settleNewPlan({ goalId: goal.id });

  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  const todo = (skill: Skill | undefined) =>
    prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, skillId: skill?.id, status: "todo" },
    });

  return { finished, settings: parsePlanSettings(saved.settings), skills: library.skills, todo };
}

describe("a language exam's listening basics after placement's text questions", () => {
  it("keeps listening lessons even when placement confirms every reading topic of their band", async () => {
    const { finished, settings, skills, todo } = await placedLearner({
      listeningLevel: "beginner",
      readingRight: [true, true],
    });

    expect(finished).toMatchObject({
      completion: {
        knownSkillIds: expect.arrayContaining(skills.slice(4, 6).map((skill) => skill.id)),
      },
      status: "ready",
    });

    expect(settings.pastBasicsAreas).toStrictEqual([]);

    await expect(
      Promise.all(skills.slice(0, 4).map((skill) => todo(skill))),
    ).resolves.toStrictEqual([2, 2, 2, 2]);
  });

  it("stay when placement missed as many of the band's text basics as it confirmed", async () => {
    const { settings, skills, todo } = await placedLearner({
      listeningLevel: "beginner",
      readingRight: [true, false],
    });

    const [sounds, talks] = skills;

    expect(settings.pastBasicsAreas).toStrictEqual([]);
    await expect(Promise.all([todo(sounds), todo(talks)])).resolves.toStrictEqual([2, 2]);
  });
});
