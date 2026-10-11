import { type CourseLevel, type Skill, prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { listeningBlueprintFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadSkillsToConfirm } from "../learner/_utils/load-skill-claims";
import { finishGoalPlacement } from "../learner/placement/finish-goal-placement";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { settleNewPlan } from "./_utils/recommended-bases";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/**
 * An IELTS-like learner with what they said of their level, whose plan has two Listening basics
 * (each built on by what comes after) and a Reading one, and who just answered onboarding's time
 * question.
 */
async function settledLearner(details: { knownSubjects?: string[]; level: OwnLevel | null }) {
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
  await settleNewPlan({ goalId: goal.id });

  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  const todo = (skill: Skill | undefined) =>
    prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, skillId: skill?.id, status: "todo" },
    });

  return { goal, settings: parsePlanSettings(saved.settings), skills: library.skills, todo, user };
}

// Placement never asks listening (a text question tests reading), so a learner who studied the
// language before met its sound drills on day one. Their level, or saying they know Listening well,
// now starts it past its basics, as if they had said those lessons are too basic: practice confirms
// them with recordings.
describe("a language exam's listening basics at the learner's own level", () => {
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

/**
 * A DELE-like learner who gave no level, on a plan with two Listening basics (each built on by what
 * comes after, in `listeningLevel`'s band) and two beginner Reading basics with intermediate Reading
 * built on them, who answered placement's text questions on the Reading basics (`readingRight`,
 * one per basic) and then onboarding's time question.
 */
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

  await Promise.all(
    reading.map(async (skill, index) => {
      const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
      const right = readingRight[index] ?? false;

      return attemptFixture({
        answer: { selectedIndex: right ? 0 : 1 },
        isCorrect: right,
        itemId: item.id,
        skillId: skill.id,
        userId: user.id,
      });
    }),
  );

  await finishGoalPlacement({ goalId: goal.id, input: {} });
  await settleNewPlan({ goalId: goal.id });

  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

  const todo = (skill: Skill | undefined) =>
    prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, skillId: skill?.id, status: "todo" },
    });

  return { goal, settings: parsePlanSettings(saved.settings), skills: library.skills, todo, user };
}

// Placement asks listening nothing (a text question tests reading), so a learner who gave no level
// and showed the text basics known still met the sound drills on day one. Text basics placement
// confirms pass over the same band's listening basics, as if the learner had said they're too
// basic: practice confirms them with recordings, and a miss brings their lessons back.
describe("a language exam's listening basics after placement's text questions", () => {
  it("start past the basics when placement confirmed the text basics of their band", async () => {
    const { goal, settings, skills, todo, user } = await placedLearner({
      listeningLevel: "beginner",
      readingRight: [true, true],
    });

    const [sounds, talks, details, gist] = skills;

    expect(settings.pastBasicsAreas).toStrictEqual(["Listening"]);
    await expect(Promise.all([todo(sounds), todo(talks)])).resolves.toStrictEqual([0, 0]);
    await expect(Promise.all([todo(details), todo(gist)])).resolves.toStrictEqual([2, 2]);

    const basics = [sounds?.id ?? "", talks?.id ?? ""];

    await expect(
      loadSkillsToConfirm({ goalId: goal.id, skillIds: basics, userId: user.id }),
    ).resolves.toStrictEqual(new Set(basics));

    // Placement's "lessons skipped" change carries them, so it names them leaving.
    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "testedOut", plan: { goalId: goal.id } },
    });

    const { effect } = parsePlanChangePayload(change.payload);

    expect(effect?.topicsLeftOut).toContainEqual({
      area: "Listening",
      topics: [sounds?.name, talks?.name],
    });

    expect(effect?.listeningPastBasics).toStrictEqual(["Listening"]);
  });

  it("stay when they sit in a band above the one placement confirmed", async () => {
    const { settings, skills, todo } = await placedLearner({
      listeningLevel: "intermediate",
      readingRight: [true, true],
    });

    const [sounds, talks] = skills;

    expect(settings.pastBasicsAreas).toStrictEqual([]);
    await expect(Promise.all([todo(sounds), todo(talks)])).resolves.toStrictEqual([2, 2]);
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
