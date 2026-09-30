import { type ExtractedMemoryFact, extractMemoryFacts } from "@zoonk/ai/tasks/v2/memory/extraction";
import { generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import { type Skill, prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { mockSession } from "../../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../../plans/_test-utils/plan-library";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { scheduleMemoryAfterSession } from "../after-session";
import { getCurrentMemoryInsight } from "./get-current-memory-insight";
import { respondToMemoryInsight } from "./respond-to-memory-insight";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

// Extraction and the coach are paid model calls; their behavior is covered by their evals.
vi.mock("@zoonk/ai/tasks/v2/memory/extraction", () => ({ extractMemoryFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/memory/insight", () => ({ generateMemoryInsight: vi.fn() }));

const DAY_MS = 86_400_000;
const NO_FACTS: ExtractedMemoryFact[] = [];
const ANSWERS_PER_DAY = 7;

const PROVENANCE = {
  generatedAt: "2026-09-26T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "memory-insight-test",
  runId: "run-gap-sizing-test",
};

const MESSAGE =
  "Fractions keep tripping you up in percentage questions. A few short lessons on fractions first should help.";

/**
 * A learner whose plan teaches two skills and who keeps missing the second one: the weak skill
 * whose missing prerequisites a plan-change insight fills.
 */
async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 2 }] }),
  ]);

  const weak = library.skills[1]!;

  const [{ goal, plan }] = await Promise.all([
    unplannedGoalFixture({ dailyMinutes: 20, kind: "learn", language: "en", userId: user.id }),
    learningProfileFixture({ birthMonth: 5, birthYear: 1990, userId: user.id }),
  ]);

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  // Noon UTC keeps every answer of a day on that day, whenever the test runs.
  const todayNoon = new Date().setUTCHours(12, 0, 0, 0);

  await Promise.all(
    Array.from({ length: 2 * ANSWERS_PER_DAY }, (_, index) =>
      attemptFixture({
        answeredAt: new Date(todayNoon - Math.floor(index / ANSWERS_PER_DAY) * DAY_MS - index),
        isCorrect: index % 2 === 0,
        skillId: weak.id,
        userId: user.id,
      }),
    ),
  );

  vi.mocked(extractMemoryFacts).mockResolvedValue({
    data: { facts: NO_FACTS },
    provenance: PROVENANCE,
  } as Awaited<ReturnType<typeof extractMemoryFacts>>);

  vi.mocked(generateMemoryInsight).mockResolvedValue({
    data: {
      kind: "planChange",
      lessonFocus: "Fractions",
      message: MESSAGE,
      skill: 1,
      studyTime: null,
    },
    provenance: PROVENANCE,
  } as Awaited<ReturnType<typeof generateMemoryInsight>>);

  return { goal, plan, user, weak };
}

/**
 * Skills that each rest on the next one, the first a direct prerequisite of `before`: the
 * unlearned chain a gap walks up.
 */
async function chainFixture({ before, names }: { before: Skill; names: string[] }) {
  const skills = await Promise.all(names.map((name) => skillFixture({ name })));

  await Promise.all(
    skills.map((skill, index) =>
      skillPrerequisiteFixture({
        prerequisiteId: skill.id,
        skillId: index === 0 ? before.id : (skills[index - 1]?.id ?? ""),
      }),
    ),
  );

  return skills;
}

/** A Library chapter whose lessons each teach one of these skills, in this order. */
async function chapterFixture({ skills, title }: { skills: Skill[]; title: string }) {
  const chapter = await libraryChapterFixture({ title });

  const lessons = await Promise.all(
    skills.map(async (skill, position) => {
      const lesson = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter.id,
        title: `${skill.name} lesson`,
      });

      await Promise.all([
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      ]);

      return lesson;
    }),
  );

  return { chapter, lessons };
}

/** The session ends and memory reads it after the response, which the test waits for. */
async function runAfterSession({ goalId, userId }: { goalId: string; userId: string }) {
  const settle = runDeferredWork();
  scheduleMemoryAfterSession({ goalId, sessionId: null, timeZone: "UTC", userId });
  await settle();
}

async function loadPlanSkillIds(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  return parsePlanGraph(plan.graph).skills.map((skill) => skill.skillId);
}

async function loadPlanLessonIds(goalId: string) {
  const items = await prisma.planItem.findMany({ where: { plan: { goalId } } });
  return items.flatMap((item) => item.lessonId ?? []);
}

function loadInsight(userId: string) {
  return prisma.memoryInsight.findFirstOrThrow({ where: { userId } });
}

describe("gap sizing for plan-change insights", () => {
  it("proposes a few lessons with their end-date effect, added once the learner accepts", async () => {
    const { goal, user, weak } = await setup();

    const [asPercentages, equivalent, basics] = await chainFixture({
      before: weak,
      names: ["Fractions as percentages", "Equivalent fractions", "What fractions are"],
    });

    await runAfterSession({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        kinds: ["tip", "planChange", "scheduleIdea"],
        skills: [
          {
            chapter: null,
            covers: ["What fractions are", "Equivalent fractions", "Fractions as percentages"],
            lessons: 3,
            name: "Fractions as percentages",
            prepares: weak.name,
          },
        ],
      }),
    );

    const insight = await loadInsight(user.id);

    expect(insight.payload).toMatchObject({
      effect: { lessonsAdded: 3, lessonsRemoved: 0 },
      planChangeStatus: "proposed",
      skillId: asPercentages?.id,
    });

    // Nothing bigger than a lesson changes the plan before the learner's OK.
    await expect(loadPlanSkillIds(goal.id)).resolves.not.toContain(asPercentages?.id);

    mockSession(user.id);

    const current = await getCurrentMemoryInsight({ goalId: goal.id });

    expect(current).toMatchObject({
      insight: {
        kind: "planChange",
        planChange: { effect: { lessonsAdded: 3 }, status: "proposed" },
      },
    });

    await respondToMemoryInsight({ input: { status: "accepted" }, insightId: insight.id });

    const skillIds = await loadPlanSkillIds(goal.id);
    const added = [basics?.id, equivalent?.id, asPercentages?.id, weak.id];

    // Prerequisites first, right before the skill they prepare for.
    expect(skillIds.filter((id) => added.includes(id))).toStrictEqual(added);
    expect(skillIds.indexOf(weak.id) - skillIds.indexOf(basics?.id ?? "")).toBe(3);
  });

  it("stops at a prerequisite the learner already knows, so one lesson applies at once", async () => {
    const { goal, user, weak } = await setup();

    const [asPercentages, equivalent] = await chainFixture({
      before: weak,
      names: ["Fractions as percentages", "Equivalent fractions", "What fractions are"],
    });

    await learnerSkillFixture({
      reps: 1,
      skillId: equivalent?.id ?? "",
      state: "learning",
      userId: user.id,
    });

    await runAfterSession({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        skills: [
          {
            chapter: null,
            covers: ["Fractions as percentages"],
            lessons: 1,
            name: "Fractions as percentages",
            prepares: weak.name,
          },
        ],
      }),
    );

    const insight = await loadInsight(user.id);

    expect(insight.payload).toMatchObject({
      effect: { lessonsAdded: 1 },
      planChangeStatus: "applied",
    });

    const skillIds = await loadPlanSkillIds(goal.id);

    expect(skillIds).toContain(asPercentages?.id);
    expect(skillIds).not.toContain(equivalent?.id);
  });

  it("offers no plan change when the missing prerequisite is one the learner knows", async () => {
    const { goal, user, weak } = await setup();

    const [asPercentages] = await chainFixture({
      before: weak,
      names: ["Fractions as percentages"],
    });

    await learnerSkillFixture({
      reps: 2,
      skillId: asPercentages?.id ?? "",
      state: "solid",
      userId: user.id,
    });

    await runAfterSession({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kinds: ["tip", "scheduleIdea"], skills: [] }),
    );
  });

  it("keeps a long chain as its lessons when the prerequisite has no chapter yet", async () => {
    const { goal, user, weak } = await setup();

    await chainFixture({
      before: weak,
      names: [
        "Fractions as percentages",
        "Fractions as decimals",
        "Simplifying fractions",
        "Equivalent fractions",
        "Parts of a whole",
        "Sharing equally",
      ],
    });

    await runAfterSession({ goalId: goal.id, userId: user.id });

    // The walk reaches one level past a few lessons: enough to know it's more than a few.
    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        skills: [
          {
            chapter: null,
            covers: [
              "Parts of a whole",
              "Equivalent fractions",
              "Simplifying fractions",
              "Fractions as decimals",
              "Fractions as percentages",
            ],
            lessons: 5,
            name: "Fractions as percentages",
            prepares: weak.name,
          },
        ],
      }),
    );

    await expect(loadInsight(user.id)).resolves.toMatchObject({
      payload: { effect: { lessonsAdded: 5 }, planChangeStatus: "proposed" },
    });
  });

  it("offers the prerequisite's chapter when the unlearned chain is a chapter's worth", async () => {
    const { goal, user, weak } = await setup();

    const [asPercentages, ...ancestors] = await chainFixture({
      before: weak,
      names: [
        "Fractions as percentages",
        "Fractions as decimals",
        "Simplifying fractions",
        "Equivalent fractions",
        "Parts of a whole",
        "Sharing equally",
      ],
    });

    const [basics, comparing, known] = await Promise.all([
      skillFixture({ name: "What fractions are" }),
      skillFixture({ name: "Comparing fractions" }),
      skillFixture({ name: "Reading fractions aloud" }),
    ]);

    const { chapter, lessons } = await chapterFixture({
      skills: [basics, asPercentages!, comparing, known],
      title: "Working with fractions",
    });

    await learnerSkillFixture({ reps: 1, skillId: known.id, state: "learning", userId: user.id });

    await runAfterSession({ goalId: goal.id, userId: user.id });

    expect(generateMemoryInsight).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        skills: [
          {
            chapter: chapter.title,
            covers: ["What fractions are", "Fractions as percentages", "Comparing fractions"],
            lessons: 3,
            name: "Fractions as percentages",
            prepares: weak.name,
          },
        ],
      }),
    );

    const insight = await loadInsight(user.id);

    expect(insight.payload).toMatchObject({
      effect: { lessonsAdded: 3 },
      planChangeStatus: "proposed",
    });

    mockSession(user.id);
    await respondToMemoryInsight({ input: { status: "accepted" }, insightId: insight.id });

    const [skillIds, lessonIds] = await Promise.all([
      loadPlanSkillIds(goal.id),
      loadPlanLessonIds(goal.id),
    ]);

    // The chapter is the unit: the chain's ancestors outside it wait for a later insight.
    expect(skillIds).toStrictEqual(expect.arrayContaining([basics.id, comparing.id]));
    expect(skillIds).not.toContain(ancestors[0]?.id);
    expect(skillIds).not.toContain(known.id);

    expect(lessonIds).toStrictEqual(
      expect.arrayContaining([lessons[0]?.id, lessons[1]?.id, lessons[2]?.id]),
    );

    expect(lessonIds).not.toContain(lessons[3]?.id);
  });
});
