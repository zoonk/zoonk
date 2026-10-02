import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { prisma } from "@zoonk/db";
import { seedV2 } from "@zoonk/db/seed/v2";
import {
  buildChapterIdentityKey,
  buildLessonIdentityKey,
  buildSkillIdentityKey,
} from "@zoonk/utils/identity-key";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { namesMatch } from "../exams/_utils/name-match";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { mistakeSnapshotSchema } from "../mistakes/mistake-snapshot";
import { parsePlanChangePayload } from "../plans/_utils/plan-change-payload";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { loadPlannerInputs, resolveMergedSkills } from "../plans/_utils/planner-inputs";
import { buildPlan } from "../plans/planner/build-plan";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "../plans/planner/plan-items";
import { parsePlanGraph, parsePlanPhases } from "../plans/planner/plan-state";
import { SESSION_ITEM_FORMATS } from "../sessions/_utils/session-items";
import { getBlockItemIds, readBlockPayload } from "../sessions/block-payload";
import { validateActivity } from "./activities/validate-activity";
import {
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "./exams/blueprint-contract";
import { isPassageInDocument } from "./exams/passage-check";
import { checkItem } from "./items/item-checks";
import { parseItemContent } from "./items/item-content";
import { STEP_CONTRACT_VERSION, parseStepContent } from "./steps/contract/step-contract";

/** Every seeded Library row carries this run id, which keeps the checks off other tests' rows. */
const SEED_RUN = "seed-v2";

/** ENEM questions always have five options, A to E. */
const ENEM_OPTIONS = 5;

/*
 * Near midnight, a day counted in 24-hour steps from the clock lands on the day before or after
 * once the clocks change. Maya's plan in New York runs for months, across the change: 00:30 there
 * before the clocks go back on November 1, and 23:30 before they go forward on March 14.
 */
const BEFORE_CLOCKS_GO_BACK = new Date("2026-09-30T04:30:00Z");
const BEFORE_CLOCKS_GO_FORWARD = new Date("2026-12-01T04:30:00Z");

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SeededLearners = Awaited<ReturnType<typeof seedV2>>["learners"];

let learners: SeededLearners;

function learnerIds() {
  return Object.values(learners).map((learner) => learner.userId);
}

async function countSeedRows() {
  const where = { runId: SEED_RUN };
  const learner = { userId: { in: learnerIds() } };

  const [chapters, items, lessons, skills, steps, attempts, events, mistakes, planItems] =
    await Promise.all([
      prisma.chapter.count({ where }),
      prisma.item.count({ where }),
      prisma.lesson.count({ where }),
      prisma.skill.count({ where }),
      prisma.step.count({ where }),
      prisma.attempt.count({ where: learner }),
      prisma.learningEvent.count({ where: learner }),
      prisma.mistake.count({ where: learner }),
      prisma.planItem.count({ where: { plan: { goal: learner } } }),
    ]);

  return { attempts, chapters, events, items, lessons, mistakes, planItems, skills, steps };
}

/**
 * What the planner makes of a seeded goal today, as the plan screen's estimate does, but at the
 * lessons' own pace: the seed can't know the pace other learners set in the database it runs on.
 */
async function planAtLessonPace(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const context = await loadPlanContext({ goal });

  if (!context) {
    throw new Error(`Goal ${goalId} has no plan`);
  }

  const graph = await resolveMergedSkills(context.state.graph);
  const { targetDate, userId } = goal;
  const inputs = await loadPlannerInputs({ goal, graph, targetDate, userId });

  const built = buildPlan({
    ...inputs,
    goal: { dailyMinutes: goal.dailyMinutes, kind: goal.kind, targetDate },
    graph,
    items: context.items,
    mode: "automatic",
    paceFactor: 1,
    settings: { ...context.state.settings, shortMockMinutes: inputs.shortMockMinutes },
    today: context.today,
  });

  return { built, context };
}

/** Each item by the planner's key and its day, in plan order. */
function describeItems(items: readonly (ExistingPlanItem | PlannedItem)[]) {
  return items.map(
    (item) =>
      `${getItemKey({ ...item, id: item.id ?? "" })}@${item.scheduledFor ? toIsoDate(item.scheduledFor) : ""}`,
  );
}

/** Each plan outside exams as the seed stored it and as the planner makes it from the skill graph. */
async function listPlansOutsideExams() {
  const goals = await prisma.goal.findMany({
    where: { kind: { not: "exam" }, userId: { in: learnerIds() } },
  });

  const plans = await Promise.all(
    goals.map(async (goal) => {
      const { built, context } = await planAtLessonPace(goal.id);

      return {
        built: {
          estimateHours: built.estimate.totalMinutes / 60,
          goal: goal.title,
          items: describeItems(built.items),
          phases: built.phases,
        },
        stored: {
          estimateHours: context.plan.estimateHours,
          goal: goal.title,
          items: describeItems(context.items),
          phases: context.phases,
        },
      };
    }),
  );

  return { built: plans.map((plan) => plan.built), stored: plans.map((plan) => plan.stored) };
}

/** A plan's items scheduled outside their phase's dates, each as `kind@day: phase start..end`. */
function listItemsOutsidePhases({
  items,
  phases,
}: {
  items: readonly { kind: string; phase: number; scheduledFor: Date | null }[];
  phases: unknown;
}) {
  const planPhases = parsePlanPhases(phases);

  return items.flatMap((item) => {
    const day = item.scheduledFor ? toIsoDate(item.scheduledFor) : "";
    const phase = planPhases[item.phase];
    const start = phase?.startDate ?? "";
    const end = phase?.endDate ?? "";
    const isInside = Boolean(start && end && day >= start && day <= end);

    return isInside ? [] : [`${item.kind}@${day}: phase ${item.phase} ${start}..${end}`];
  });
}

/** The plans outside exams of a seed run at another moment. */
async function listPlansSeededAt(moment: Date) {
  vi.setSystemTime(moment);
  await seedV2(prisma);
  return listPlansOutsideExams();
}

/*
 * One file seeds once for every check: two files seeding the same rows in parallel would race on
 * their unique keys.
 */
describe("v2 seed", () => {
  beforeAll(async () => {
    // The checks plan from the day the seed ran: a run crossing a learner's midnight would compare
    // two days.
    vi.useFakeTimers({ toFake: ["Date"] });
    ({ learners } = await seedV2(prisma));
  }, 120_000);

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("library", () => {
    it("stores every step in the v2 step contract", async () => {
      const steps = await prisma.step.findMany({ where: { runId: SEED_RUN } });

      const failures = steps.flatMap((step) => {
        try {
          parseStepContent(step.kind, step.content);

          if (step.contractVersion !== STEP_CONTRACT_VERSION) {
            throw new Error(`Contract version ${step.contractVersion}`);
          }

          return [];
        } catch (error) {
          return [
            {
              error: describeError(error),
              kind: step.kind,
              lessonId: step.lessonId,
              position: step.position,
            },
          ];
        }
      });

      expect(steps.length).toBeGreaterThan(0);
      expect(failures).toStrictEqual([]);
    });

    it("publishes only activities that pass validation", async () => {
      const activities = await prisma.step.findMany({
        where: { kind: "activity", runId: SEED_RUN },
      });

      const failures = activities.flatMap((step) => {
        const result = validateActivity(step.content);

        return result.ok
          ? []
          : [{ issues: result.issues, lessonId: step.lessonId, position: step.position }];
      });

      expect(activities.length).toBeGreaterThan(0);
      expect(failures).toStrictEqual([]);
    });

    it("stores bank questions that pass the item checks", async () => {
      const items = await prisma.item.findMany({
        include: { examBlueprint: { select: { identityKey: true } } },
        where: { runId: SEED_RUN },
      });

      const failures = items.flatMap((item) => {
        const parsed = parseItemContent({ content: item.content, format: item.format });

        const generated = {
          ...parsed.content,
          difficulty: "medium",
          format: parsed.format,
        } as GeneratedItem;

        const problems = checkItem({
          item: generated,
          optionCount:
            item.examBlueprint?.identityKey === "enem" && item.format === "multipleChoice"
              ? ENEM_OPTIONS
              : null,
        });

        return problems.length === 0 ? [] : [{ id: item.id, problems }];
      });

      expect(items.length).toBeGreaterThan(0);
      expect(failures).toStrictEqual([]);
    });

    it("cites a stored passage for every ENEM blueprint fact", async () => {
      const blueprints = await prisma.examBlueprint.findMany({
        where: { identityKey: "enem", runId: SEED_RUN },
      });

      const sources = await prisma.source.findMany({
        where: { id: { in: blueprints.flatMap((row) => row.sourceId ?? []) } },
      });

      const parsed = blueprints.map((blueprint) => ({
        edition: examEditionSchema.parse(blueprint.edition),
        structure: examStructureSchema.parse(blueprint.structure),
        topicFrequency: topicFrequencySchema.parse(blueprint.topicFrequency),
      }));

      const citations = parsed.flatMap(({ edition, structure, topicFrequency }) => [
        ...edition.citations,
        ...edition.dates.map((date) => date.citation),
        ...structure.formats.map((format) => format.citation),
        ...structure.rules.map((rule) => rule.citation),
        ...structure.subjects.map((subject) => subject.citation),
        ...(structure.mock?.citations ?? []),
        ...topicFrequency.map((entry) => entry.citation),
      ]);

      const citedSources = await prisma.source.findMany({
        where: { id: { in: citations.map((citation) => citation.sourceId) } },
      });

      const missing = citations.filter((citation) => {
        const text =
          citedSources.find((source) => source.id === citation.sourceId)?.extractedText ?? "";

        return !isPassageInDocument({ passage: citation.passage, text });
      });

      expect(blueprints.map((blueprint) => blueprint.language).toSorted()).toStrictEqual([
        "en",
        "pt",
      ]);

      expect(sources).toHaveLength(1);
      expect(missing).toStrictEqual([]);
    });

    it("names each ENEM area once", async () => {
      const blueprints = await prisma.examBlueprint.findMany({
        where: { identityKey: "enem", runId: SEED_RUN },
      });

      const repeated = blueprints.flatMap((blueprint) => {
        const names = examStructureSchema
          .parse(blueprint.structure)
          .subjects.map((subject) => subject.name);

        return names.filter((name, index) => names.indexOf(name) !== index);
      });

      expect(blueprints).toHaveLength(2);
      expect(repeated).toStrictEqual([]);
    });

    it("builds identity keys the way identity search does", async () => {
      const [chapters, lessons, skills] = await Promise.all([
        prisma.chapter.findMany({ where: { runId: SEED_RUN } }),
        prisma.lesson.findMany({
          include: { homeChapter: { select: { homeCourseId: true } }, skills: true },
          where: { runId: SEED_RUN },
        }),
        prisma.skill.findMany({ where: { runId: SEED_RUN } }),
      ]);

      const mismatches = [
        ...chapters.filter(
          (chapter) =>
            chapter.identityKey !==
            buildChapterIdentityKey({ ...chapter, courseId: chapter.homeCourseId }),
        ),
        ...lessons.filter(
          (lesson) =>
            lesson.identityKey !==
            buildLessonIdentityKey({
              courseId: lesson.homeChapter?.homeCourseId ?? null,
              level: lesson.level,
              skillIds: lesson.skills.map((row) => row.skillId),
              targetLanguage: lesson.targetLanguage,
            }),
        ),
        ...skills.filter((skill) => skill.identityKey !== buildSkillIdentityKey(skill)),
      ].map((row) => row.identityKey);

      expect(mismatches).toStrictEqual([]);
    });

    it("gives every written lesson a summary card and every outline lesson its skills", async () => {
      const lessons = await prisma.lesson.findMany({
        include: { _count: { select: { skills: true, steps: true } } },
        where: { runId: SEED_RUN },
      });

      const written = lessons.filter((lesson) => lesson._count.steps > 0);

      expect(written.length).toBeGreaterThan(0);

      expect(
        written.filter((lesson) => lesson.summary === null).map((lesson) => lesson.title),
      ).toStrictEqual([]);

      expect(
        lessons.filter((lesson) => lesson._count.skills === 0).map((lesson) => lesson.title),
      ).toStrictEqual([]);
    });

    it("runs again without duplicating anything", async () => {
      const before = await countSeedRows();

      await seedV2(prisma);

      await expect(countSeedRows()).resolves.toStrictEqual(before);
    }, 120_000);
  });

  describe("learners", () => {
    it("stores plans the planner can read: phases with dates, the skill graph and changes", async () => {
      const plans = await prisma.plan.findMany({
        include: { changes: true },
        where: { goal: { userId: { in: learnerIds() } } },
      });

      const unreadable = plans.filter(
        (plan) =>
          !Array.isArray(plan.phases) ||
          parsePlanPhases(plan.phases).length !== plan.phases.length ||
          parsePlanGraph(plan.graph).skills.length === 0,
      );

      const changes = plans.flatMap((plan) => plan.changes);
      const edits = changes.filter((change) => change.kind === "edited");

      expect(plans).toHaveLength(Object.keys(learners).length);
      expect(unreadable.map((plan) => plan.goalId)).toStrictEqual([]);

      expect(
        edits.filter((change) => parsePlanChangePayload(change.payload).operations.length === 0),
      ).toStrictEqual([]);

      expect(changes.some((change) => change.status === "proposed")).toBe(true);
    });

    /*
     * Exam plans keep the persona's own windows and hand-placed items, so only the seed keeps each
     * item inside its phase: an exam too close for them ends a window before its items, or before
     * it starts.
     */
    it("keeps every exam plan item inside its phase's dates", async () => {
      const plans = await prisma.plan.findMany({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goal: { kind: "exam", userId: { in: learnerIds() } } },
      });

      expect(plans.length).toBeGreaterThan(0);
      expect(plans.flatMap((plan) => listItemsOutsidePhases(plan))).toStrictEqual([]);
    });

    /*
     * The plan screen plans from the skill graph: its estimate and each phase's size and dates
     * only agree when the seed stores the plan the planner makes, weekly challenges and phase
     * checkpoints included. Exam plans keep the persona's own windows.
     */
    it("stores the plan the planner makes from the skill graph outside exams", async () => {
      const { built, stored } = await listPlansOutsideExams();

      expect(stored.length).toBeGreaterThan(0);
      expect(stored).toStrictEqual(built);
    });

    it("stores the plan the planner makes when the clocks change while it runs", async () => {
      const today = new Date();
      const goingBack = await listPlansSeededAt(BEFORE_CLOCKS_GO_BACK);
      const goingForward = await listPlansSeededAt(BEFORE_CLOCKS_GO_FORWARD);

      // The other checks read today's seed.
      vi.setSystemTime(today);
      await seedV2(prisma);

      expect(goingBack.stored).toStrictEqual(goingBack.built);
      expect(goingForward.stored).toStrictEqual(goingForward.built);
    }, 120_000);

    it("closes each phase with a phase checkpoint, never a weekly challenge", async () => {
      const bosses = await prisma.planItem.findMany({
        where: {
          kind: "boss",
          plan: { goal: { kind: { not: "exam" }, userId: { in: learnerIds() } } },
        },
      });

      const plans = await prisma.plan.findMany({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goal: { kind: { in: ["learn", "language"] }, userId: { in: learnerIds() } } },
      });

      const missing = plans.flatMap((plan) =>
        parsePlanPhases(plan.phases).flatMap((phase, index) => {
          const last = plan.items.findLast(
            (item) => item.phase === index && item.kind !== "checkpoint",
          );

          return last?.kind === "boss" ? [] : [`${plan.goalId}: ${phase.name}`];
        }),
      );

      expect(bosses.length).toBeGreaterThan(0);
      expect(missing).toStrictEqual([]);
    });

    it("builds today's blocks in the session payload shape, asking only questions sessions grade", async () => {
      const blocks = await prisma.studySessionBlock.findMany({
        where: { kind: { in: ["practice", "review"] }, session: { userId: { in: learnerIds() } } },
      });

      const itemIds = blocks.flatMap((block) => getBlockItemIds(readBlockPayload(block)));
      const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
      const gradable: readonly string[] = SESSION_ITEM_FORMATS;

      expect(
        blocks.filter((block) => getBlockItemIds(readBlockPayload(block)).length === 0),
      ).toStrictEqual([]);

      expect(items).toHaveLength(new Set(itemIds).size);

      expect(
        items.filter((item) => !gradable.includes(item.format)).map((item) => item.id),
      ).toStrictEqual([]);
    });

    it("gives every learner an active goal with a plan, today's session, skills and history", async () => {
      const users = await prisma.user.findMany({
        include: {
          _count: { select: { learnerSkills: true, learningEvents: true, studySessions: true } },
          goals: { include: { plan: { include: { _count: { select: { items: true } } } } } },
          learningProfile: true,
          studySessions: { include: { _count: { select: { blocks: true } } } },
        },
        where: { id: { in: learnerIds() } },
      });

      expect(users).toHaveLength(Object.keys(learners).length);

      const gaps = users.flatMap((user) => {
        const goal = user.goals[0];

        return [
          user.learningProfile?.activeGoalId !== goal?.id && `${user.email}: active goal`,
          !goal?.plan?._count.items && `${user.email}: plan items`,
          user.studySessions[0]?._count.blocks ? null : `${user.email}: today's session`,
          user._count.learnerSkills === 0 && `${user.email}: skills`,
          user._count.learningEvents === 0 && `${user.email}: history`,
        ].filter((gap) => typeof gap === "string");
      });

      expect(gaps).toStrictEqual([]);
    });

    it("covers every goal kind", async () => {
      const goals = await prisma.goal.findMany({ where: { userId: { in: learnerIds() } } });

      expect(new Set(goals.map((goal) => goal.kind))).toStrictEqual(
        new Set(["explain", "exam", "language", "learn"]),
      );

      expect(goals.find((goal) => goal.kind === "exam")?.targetDate).not.toBeNull();
    });

    it("links every plan to Library skills that placement and preparation can read", async () => {
      const plans = await Promise.all(
        Object.values(learners).map((learner) => loadGoalPlan(learner.goalId)),
      );

      expect(plans.filter((plan) => plan.skills.length === 0)).toStrictEqual([]);
    });

    /*
     * Mocks group their scores by the plan's area of each question's skill, falling back to the
     * exam day's name, so a bank question outside the plan's areas shows up as a made-up area.
     */
    it("puts every exam bank question in a plan area that names one of the exam's areas", async () => {
      const goal = await prisma.goal.findUniqueOrThrow({
        include: { examBlueprint: true, plan: true },
        where: { id: learners.exam.goalId },
      });

      const items = await prisma.item.findMany({
        where: { examBlueprintId: goal.examBlueprintId },
      });

      const { subjects } = examStructureSchema.parse(goal.examBlueprint?.structure);

      const areas = new Map(
        parsePlanGraph(goal.plan?.graph).skills.map((skill) => [skill.skillId, skill.area]),
      );

      const outside = items.filter((item) => {
        const area = areas.get(item.skillId);
        return !area || subjects.filter((subject) => namesMatch(area, subject.name)).length !== 1;
      });

      expect(items.length).toBeGreaterThan(0);
      expect(outside.map((item) => item.id)).toStrictEqual([]);
    });

    it("keeps a readable snapshot for every mistake in the notebook", async () => {
      const mistakes = await prisma.mistake.findMany({ where: { userId: { in: learnerIds() } } });

      expect(mistakes.length).toBeGreaterThan(0);

      expect(
        mistakes.filter((mistake) => !mistakeSnapshotSchema.safeParse(mistake.snapshot).success),
      ).toStrictEqual([]);

      expect(mistakes.filter((mistake) => mistake.attemptId === null)).toStrictEqual([]);
    });

    it("seeds Fun with a buddy, a minor with a guardian and an anonymous guest", async () => {
      const [fun, minor, guest] = await Promise.all([
        prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: learners.fun.userId } }),
        prisma.user.findUniqueOrThrow({
          include: { guardianLinks: true, learningProfile: true },
          where: { id: learners.minor.userId },
        }),
        prisma.user.findUniqueOrThrow({ where: { id: learners.guest.userId } }),
      ]);

      expect(fun).toMatchObject({ buddyGlasses: "star", buddyKind: "otto", experienceMode: "fun" });
      expect(minor.learningProfile?.birthYear).toBeGreaterThan(new Date().getUTCFullYear() - 18);
      expect(minor.guardianLinks[0]?.status).toBe("active");
      expect(guest.isAnonymous).toBe(true);
    });
  });
});
