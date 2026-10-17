import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningBlueprintFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateGoal } from "../goals/update-goal";
import { completeLessonPlanItems } from "../sessions/_utils/plan-items";
import { getProgressView } from "../view-models/progress/get-progress-view";
import { getTodayView } from "../view-models/today/get-today-view";
import { AHEAD_START, aheadPlanFixture } from "./_test-utils/ahead-plan";
import { planCacheKey } from "./_test-utils/plan-cache-platform";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { readBuiltPlan } from "./_utils/read-built-plan";
import { readPlanAnalysis } from "./_utils/read-plan-analysis";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlanScreen } from "./get-goal-plan";
import { getGoalResumePreview } from "./get-goal-resume-preview";
import { findPlanTimeToCover } from "./get-time-advice";
import { previewPlanChange } from "./preview-plan-change";

// Observe the Next cache leaf while executing its real planner. Auth/cache are the existing
// framework boundaries; none of the persistence, input loaders or planning rules are replaced.
vi.mock("./_utils/read-built-plan", async (importOriginal) => {
  const actual = await importOriginal<{ readBuiltPlan: typeof readBuiltPlan }>();
  return { ...actual, readBuiltPlan: vi.fn(actual.readBuiltPlan) };
});

vi.mock("./_utils/read-plan-analysis", async (importOriginal) => {
  const actual = await importOriginal<{ readPlanAnalysis: typeof readPlanAnalysis }>();
  return { ...actual, readPlanAnalysis: vi.fn(actual.readPlanAnalysis) };
});

const NOW = new Date("2026-10-14T12:00:00Z");
/** Installed RSC argument encoding, including actual Map/Set insertion order and Date values. */
async function encodedKey(value: unknown): Promise<string> {
  return planCacheKey(["plan-read-regression", [value], ""]);
}

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      phases: ["Foundations", "Applying the foundations"],
      skills: [
        { area: "Math", lessons: 4, level: "beginner" },
        { area: "Math", builds: 0, lessons: 4, level: "intermediate", phase: 1 },
      ],
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: NOW,
    dailyMinutes: 30,
    kind: "learn",
    settings: { pace: { factor: 1, source: "typical" }, startDate: "2026-10-14" },
    targetDate: null,
    timezone: "UTC",
    userId: user.id,
  });

  await Promise.all(
    library.skills.flatMap((skill) =>
      Array.from({ length: 6 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
  );

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  vi.mocked(readBuiltPlan).mockClear();
  vi.mocked(readPlanAnalysis).mockClear();
  return { goal, library, plan, user };
}

function lastRead(goalId: string) {
  const call = vi
    .mocked(readBuiltPlan)
    .mock.calls.findLast(([args]) => args.input.goalId === goalId)?.[0];

  if (!call) {
    throw new Error("The real read must reach the shared pure build boundary");
  }

  return call;
}

async function savedPlan(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { changes: true, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

describe("fresh owned inputs at the shared planning cache boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("routes real exported previews through the read leaf without saving, while Apply stays fresh", async () => {
    const { goal, plan } = await setup();
    const before = await savedPlan(plan.id);

    const input = {
      operations: [{ kind: "setDailyMinutes" as const, minutes: 45 }],
      timeZone: "UTC",
    };

    const result = await previewPlanChange({ goalId: goal.id, input });
    expect(result).toMatchObject({ preview: { ready: true, unchanged: false }, status: "ready" });

    expect(
      vi.mocked(readBuiltPlan).mock.calls.map(([args]) => args.input.goal.dailyMinutes),
    ).toStrictEqual(expect.arrayContaining([30, 45]));

    await expect(savedPlan(plan.id)).resolves.toStrictEqual(before);

    vi.mocked(readBuiltPlan).mockClear();

    await expect(changeGoalPlan({ goalId: goal.id, input })).resolves.toMatchObject({
      status: "applied",
    });

    expect(readBuiltPlan).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 45,
    });
  });

  it("keeps the full installed-RSC key stable across fresh loads and an unrelated real skill write", async () => {
    const { goal, library, plan } = await setup();
    await getGoalPlanScreen(goal.id);
    const first = lastRead(goal.id);
    const saved = await savedPlan(plan.id);

    expect(first.input.graph.skills.map((skill) => skill.skillId)).toStrictEqual(
      library.graph.skills.map((skill) => skill.skillId),
    );

    expect(first.input.lessons.map((lesson) => lesson.lessonId)).toStrictEqual(
      library.lessons.map((lesson) => lesson.id),
    );

    expect(first.input.items.map((item) => item.id)).toStrictEqual(
      saved.items.map((item) => item.id),
    );

    expect(first.input.prerequisites.get(library.skills[1]?.id ?? "")).toStrictEqual([
      library.skills[0]?.id,
    ]);

    expect([...(first.input.bands?.keys() ?? [])]).toStrictEqual(
      library.skills.map((skill) => skill.id).toSorted(),
    );

    const key = await encodedKey(first);

    await getGoalPlanScreen(goal.id);
    await expect(encodedKey(lastRead(goal.id))).resolves.toBe(key);

    await prisma.skill.update({
      data: { description: "An unrelated description update, not a planner input" },
      where: { id: library.skills[0]?.id },
    });

    await getGoalPlanScreen(goal.id);
    await expect(encodedKey(lastRead(goal.id))).resolves.toBe(key);
  });

  it("reads a changed real question bank without relying on the unchanged saved plan version", async () => {
    const { goal, library, plan } = await setup();
    await getGoalPlanScreen(goal.id);
    const before = lastRead(goal.id);
    const firstKey = await encodedKey(before);
    const saved = await savedPlan(plan.id);
    const version = saved.version;
    const skillId = library.skills[0]?.id ?? "";
    expect(before.input.bossFacts?.bank.textCounts.get(skillId)).toBe(6);

    await itemFixture({ content: choiceItemContent(), skillId });
    const result = await getGoalPlanScreen(goal.id);
    expect(result.status).toBe("ready");
    const after = lastRead(goal.id);
    expect(after.input.bossFacts?.bank.textCounts.get(skillId)).toBe(7);
    await expect(encodedKey(after)).resolves.not.toBe(firstKey);
    await expect(savedPlan(plan.id)).resolves.toMatchObject({ version });

    const actual: Awaited<ReturnType<typeof readBuiltPlan>> = await vi
      .mocked(readBuiltPlan)
      .mock.results.at(-1)?.value;

    expect(actual?.items.find((item) => item.kind === "boss" && item.phase === 0)?.minutes).toBe(
      11,
    );
  });

  it("namespaces actual owned reads by actor and refuses another learner before the leaf", async () => {
    const { goal, user } = await setup();
    await getGoalPlanScreen(goal.id);
    const owned = lastRead(goal.id);
    expect(owned.userId).toBe(user.id);

    const other = await userFixture();

    await expect(encodedKey({ ...owned, userId: other.id })).resolves.not.toBe(
      await encodedKey(owned),
    );

    vi.mocked(readBuiltPlan).mockClear();
    mockSession(other.id);
    await expect(getGoalPlanScreen(goal.id)).resolves.toStrictEqual({ status: "notFound" });
    expect(readBuiltPlan).not.toHaveBeenCalled();
  });

  it("keeps readiness lookup order independent of the database row insertion order", async () => {
    const { goal, library, user } = await setup();

    await prisma.goal.update({
      data: { kind: "exam", targetDate: new Date("2026-11-30T00:00:00Z") },
      where: { id: goal.id },
    });

    const ordered = library.skills.toSorted((a, b) => a.id.localeCompare(b.id));
    await learnerSkillFixture({ skillId: ordered[1]?.id ?? "", userId: user.id });
    await learnerSkillFixture({ skillId: ordered[0]?.id ?? "", userId: user.id });
    await getGoalPlanScreen(goal.id);

    expect([...lastRead(goal.id).input.readiness.keys()]).toStrictEqual(
      ordered.map((skill) => skill.id),
    );
  });

  it("keys actual completion by its finished local day without requiring a plan version increment", async () => {
    const { goal, library, plan, user } = await setup();
    await getGoalPlanScreen(goal.id);
    const before = lastRead(goal.id);
    const saved = await savedPlan(plan.id);
    const version = saved.version;
    const lessonId = library.lessons[0]?.id ?? "";
    const item = before.input.items.find((entry) => entry.lessonId === lessonId);
    expect(item?.status).toBe("todo");

    await prisma.$transaction((tx) =>
      completeLessonPlanItems(tx, { lessonId, now: NOW, userId: user.id }),
    );

    await getGoalPlanScreen(goal.id);
    const after = lastRead(goal.id);

    expect(after.input.items.find((entry) => entry.id === item?.id)).toMatchObject({
      completedAt: NOW,
      status: "done",
    });

    expect(after.input.finishedOn?.get(item?.id ?? "")).toStrictEqual(
      new Date("2026-10-14T00:00:00Z"),
    );

    await expect(encodedKey(after)).resolves.not.toBe(await encodedKey(before));
    await expect(savedPlan(plan.id)).resolves.toMatchObject({ version });
  });

  it("requests explicit screen analysis while Progress never warms advice", async () => {
    const { goal } = await setup();
    const screen = await getGoalPlanScreen(goal.id);
    expect(screen.status).toBe("ready");
    const args = vi.mocked(readPlanAnalysis).mock.calls.at(-1)?.[0];
    expect(args).toMatchObject({ input: { goalId: goal.id } });
    expect(args).not.toHaveProperty("planned");
    expect(args).toHaveProperty("landing");

    const actual: Awaited<ReturnType<typeof readPlanAnalysis>> = await vi
      .mocked(readPlanAnalysis)
      .mock.results.at(-1)?.value;

    expect(actual.feasibility).not.toHaveProperty("coreMinutes");

    expect(
      Object.values(Object.getOwnPropertyDescriptors(actual.feasibility)).every(
        (field) => !field.get,
      ),
    ).toBe(true);

    vi.mocked(readPlanAnalysis).mockClear();
    await expect(getProgressView({ goalId: goal.id })).resolves.toMatchObject({ status: "ready" });
    expect(readPlanAnalysis).not.toHaveBeenCalled();
  });

  it("shares the real fit offer's baseline and requested builds without saving the offered work", async () => {
    vi.setSystemTime(AHEAD_START);
    const { goal, plan } = await aheadPlanFixture({ dailyMinutes: 15, faster: true });
    const before = await savedPlan(plan.id);
    vi.mocked(readBuiltPlan).mockClear();

    const result = await getGoalPlanScreen(goal.id);

    expect(result).toMatchObject({
      plan: {
        fitOffer: {
          effect: { lessonsAdded: expect.any(Number) },
          operations: [{ kind: "fitLessons" }],
        },
      },
      status: "ready",
    });

    if (result.status !== "ready") {
      throw new Error("Expected the actual fitting offer");
    }

    expect(result.plan.fitOffer?.effect.lessonsAdded).toBeGreaterThan(0);

    expect(
      vi
        .mocked(readBuiltPlan)
        .mock.calls.some(
          ([args]) =>
            args.input.goalId === goal.id &&
            args.input.mode === "forced" &&
            args.input.bringBackSetAside,
        ),
    ).toBe(true);

    await expect(savedPlan(plan.id)).resolves.toStrictEqual(before);
  });

  it("finds a past date's new date only when asked, sharing its builds without changing the plan", async () => {
    const { goal, plan } = await setup();

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setTargetDate", targetDate: "2026-10-21" }] },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    const before = await savedPlan(plan.id);
    vi.mocked(readBuiltPlan).mockClear();

    const undatedBuilds = () =>
      vi
        .mocked(readBuiltPlan)
        .mock.calls.filter(
          ([args]) =>
            args.input.goalId === goal.id &&
            args.input.mode === "forced" &&
            args.input.goal.targetDate === null,
        ).length;

    await expect(getGoalPlanScreen(goal.id)).resolves.toMatchObject({
      plan: { status: { kind: "pastDate" } },
      status: "ready",
    });

    // Reading the plan searches no date: no plan without its date is built for the screen.
    expect(undatedBuilds()).toBe(0);

    // The learner asks: the date search plans its undated and candidate builds as cached reads.
    await expect(findPlanTimeToCover({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      status: "ready",
      time: { fittingDate: expect.any(String) },
    });

    expect(undatedBuilds()).toBeGreaterThan(0);

    await expect(savedPlan(plan.id)).resolves.toStrictEqual(before);
  });

  it("shares an actual Today proposal only after its ordinary saved-day resolution", async () => {
    const { goal, plan } = await setup();

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
    });

    const proposed = await planChangeFixture({
      createdAt: NOW,
      kind: "edited",
      payload: { operations: [{ kind: "setDailyMinutes", minutes: 45 }], source: "planEdit" },
      planId: plan.id,
      status: "proposed",
    });

    vi.mocked(readBuiltPlan).mockClear();
    vi.mocked(readPlanAnalysis).mockClear();

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
      today: { planChange: { id: proposed.id, status: "proposed" } },
    });

    expect(
      vi.mocked(readBuiltPlan).mock.calls.map(([args]) => args.input.goal.dailyMinutes),
    ).toStrictEqual(expect.arrayContaining([30, 45]));

    expect(readPlanAnalysis).not.toHaveBeenCalled();

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: proposed.id } }),
    ).resolves.toMatchObject({ status: "proposed" });
  });

  it("shares an exported paused-goal preview while an actual resume remains a fresh mutation", async () => {
    const { goal, plan } = await setup();
    await updateGoal({ goalId: goal.id, input: { status: "paused" } });
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
    const before = await savedPlan(plan.id);
    vi.mocked(readBuiltPlan).mockClear();

    await expect(getGoalResumePreview(goal.id)).resolves.toMatchObject({
      preview: { ready: true, unchanged: false },
      status: "ready",
    });

    expect(lastRead(goal.id).input.mode).toBe("forced");
    await expect(savedPlan(plan.id)).resolves.toStrictEqual(before);

    vi.mocked(readBuiltPlan).mockClear();

    await expect(
      updateGoal({ goalId: goal.id, input: { status: "active" } }),
    ).resolves.toMatchObject({ status: "updated" });

    expect(readBuiltPlan).not.toHaveBeenCalled();
  });

  it("keys fresh voiced recording evidence while the saved plan version stays unchanged", async () => {
    const [user, blueprint, library] = await Promise.all([
      userFixture(),
      listeningBlueprintFixture({ name: `Cache recording ${crypto.randomUUID()}` }),
      planLibraryFixture({ skills: [{ area: "Listening", lessons: 2 }] }),
    ]);

    const skillId = library.skills[0]?.id ?? "";

    const recording = await listeningSetFixture({
      examBlueprintId: blueprint.id,
      mediaAssetId: null,
    });

    await Promise.all(
      Array.from({ length: 6 }, (_, setPosition) =>
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          setId: recording.id,
          setPosition,
          skillId,
        }),
      ),
    );

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: NOW,
      dailyMinutes: 60,
      examBlueprintId: blueprint.id,
      kind: "exam",
      settings: { pace: { factor: 1, source: "typical" }, startDate: "2026-10-14" },
      targetDate: new Date("2026-11-30T00:00:00Z"),
      targetLanguage: "en",
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
      status: "created",
    });

    await getGoalPlanScreen(goal.id);
    const before = lastRead(goal.id);
    expect(before.input.bossFacts?.bank.recordingSets).toHaveLength(0);
    const saved = await savedPlan(plan.id);
    const media = await mediaAssetFixture();
    await prisma.itemSet.update({ data: { mediaAssetId: media.id }, where: { id: recording.id } });
    await getGoalPlanScreen(goal.id);
    const after = lastRead(goal.id);
    expect(after.input.bossFacts?.bank.recordingSets).toHaveLength(1);
    await expect(encodedKey(after)).resolves.not.toBe(await encodedKey(before));
    await expect(savedPlan(plan.id)).resolves.toMatchObject({ version: saved.version });

    const actual: Awaited<ReturnType<typeof readBuiltPlan>> = await vi
      .mocked(readBuiltPlan)
      .mock.results.at(-1)?.value;

    expect(actual.items.some((item) => item.kind === "boss" && item.minutes === 9)).toBe(true);
  });
});
