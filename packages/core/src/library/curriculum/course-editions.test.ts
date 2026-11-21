import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getCourseCacheTag, getGoalsCacheTag } from "../../cache/tags";
import { startCourseGoal } from "../../goals/start-course-goal";
import { updateGoal } from "../../goals/update-goal";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { getOnboarding } from "../../view-models/onboarding/get-onboarding";
import { claimCourseOutline, finishCourseOutline } from "./course-outline-state";
import { setGoalPrimaryCourse } from "./goal-primary-course";
import { linkResolvedCourseEdition } from "./link-resolved-course-edition";

describe("naming a goal from its resolved course edition", () => {
  it.each([
    { adopted: false, displayName: "Economia", name: undefined },
    { adopted: true, displayName: "Economia", name: undefined },
    { adopted: true, displayName: "Meu projeto", name: "Meu projeto" },
  ])("uses the course title when saving a plan: %j", async ({ adopted, displayName, name }) => {
    const [source, edition, skill, user] = await Promise.all([
      courseFixture({ isPublished: true, title: "Economics" }),
      courseFixture({ language: "pt-BR", title: "Economia" }),
      skillFixture(),
      userFixture(),
    ]);

    mockSession(user.id);
    const started = await startCourseGoal({ courseId: source.id, input: { language: "pt" } });

    expect(started).toMatchObject({
      goal: { displayName: source.title, primaryCourseId: null, title: source.title },
      status: "created",
    });

    if (started.status !== "created") {
      throw new Error("Expected a new goal");
    }

    const goalId = started.goal.id;

    if (adopted) {
      await setGoalPrimaryCourse({ courseId: edition.id, goalId });
    }

    if (name) {
      await updateGoal({ goalId, input: { displayName: name } });
    }

    vi.mocked(revalidateTag).mockClear();

    await createGoalPlan({
      goalId,
      graph: {
        phases: [{ milestone: null, name: "Introdução" }],
        skills: [
          {
            area: null,
            courseIds: [edition.id],
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
      primaryCourseId: edition.id,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      displayName,
      primaryCourseId: edition.id,
      prompt: source.title,
      title: edition.title,
    });

    await expect(getOnboarding({ goalId, locale: "pt" })).resolves.toMatchObject({
      onboarding: { goal: { displayName, title: edition.title } },
      status: "ready",
    });

    expect(revalidateTag).toHaveBeenCalledWith(getGoalsCacheTag(user.id), { expire: 0 });
  });
});

async function resolvedPair({
  existing = "neither",
  country = null,
  editionCountry = null,
  missingCourse = false,
  firstPlan = true,
  multiple = false,
  published = false,
  visibility = "public",
}: {
  country?: string | null;
  editionCountry?: string | null;
  missingCourse?: boolean;
  firstPlan?: boolean;
  existing?: "neither" | "source" | "edition" | "both";
  multiple?: boolean;
  published?: boolean;
  visibility?: "private" | "public";
} = {}) {
  const [first, second, user] = await Promise.all([
    prisma.courseFamily.create({ data: {} }),
    prisma.courseFamily.create({ data: {} }),
    userFixture(),
  ]);

  const [source, edition] = await Promise.all([
    courseFixture({
      country,
      familyId: existing === "source" || existing === "both" ? first.id : null,
      isPublished: true,
    }),
    courseFixture({
      country: editionCountry,
      familyId: existing === "edition" || existing === "both" ? second.id : null,
      isPublished: published,
      language: "pt-BR",
      outlineStatus: "pending",
      visibility,
    }),
  ]);

  const goal = await goalFixture({
    language: "pt",
    primaryCourseId: edition.id,
    sourceCourseId: source.id,
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: {
      editionCandidate: firstPlan,
      skills: [
        {
          courseIds: multiple ? [edition.id, randomUUID()] : [edition.id],
          lessons: 1,
          name: "Study",
          phase: 0,
          skillId: randomUUID(),
        },
        ...(missingCourse ? [{ lessons: 1, name: "Other", phase: 0, skillId: randomUUID() }] : []),
      ],
    },
  });

  const runId = randomUUID();

  if (published) {
    await linkResolvedCourseEdition({ courseId: edition.id });
  } else {
    await claimCourseOutline({ courseId: edition.id, workflowRunId: runId });
    await finishCourseOutline({ courseId: edition.id, status: "completed", workflowRunId: runId });
  }

  return {
    edition: await prisma.course.findUniqueOrThrow({ where: { id: edition.id } }),
    expected: source.familyId ?? edition.familyId,
    original: [source.familyId, edition.familyId],
    source: await prisma.course.findUniqueOrThrow({ where: { id: source.id } }),
  };
}

describe("linking a resolved course edition", () => {
  it("keeps the first plan eligible across a replay until a rebuild replaces it", async () => {
    const [source, edition, skill, user] = await Promise.all([
      courseFixture({ isPublished: true }),
      courseFixture({ isPublished: true, language: "pt" }),
      skillFixture(),
      userFixture(),
    ]);

    mockSession(user.id);
    const start = await startCourseGoal({ courseId: source.id, input: { language: "pt" } });

    if (start.status !== "created") {
      throw new Error("Expected a new goal");
    }

    const goalId = start.goal.id;

    const graph = {
      phases: [],
      skills: [
        {
          area: null,
          courseIds: [edition.id],
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    };

    const save = (initial: boolean) =>
      createGoalPlan({
        goalId,
        graph: initial ? { ...graph, editionCandidate: true } : graph,
        primaryCourseId: edition.id,
      });

    const read = () =>
      prisma.plan.findUniqueOrThrow({ select: { graph: true }, where: { goalId } });

    await save(true);
    await save(true);
    await expect(read()).resolves.toHaveProperty("graph.editionCandidate", true);
    await save(false);
    await save(true);
    await expect(read()).resolves.not.toHaveProperty("graph.editionCandidate");
  });

  it("links an already published edition when the goal's plan is saved", async () => {
    const { edition, source } = await resolvedPair({ published: true });

    expect(source.familyId).toBeTruthy();
    expect(edition.familyId).toBe(source.familyId);
  });

  it.each(["neither", "source", "edition"] as const)(
    "links the resolved edition when %s already has a family",
    async (existing) => {
      const { edition, expected, source } = await resolvedPair({ existing });

      expect(source.familyId).toBeTruthy();
      expect(edition.familyId).toBe(source.familyId);
      expect(edition.familyId).toBe(expected ?? source.familyId);
      expect(revalidateTag).toHaveBeenCalledWith(getCourseCacheTag(source.id), { expire: 0 });
      expect(revalidateTag).toHaveBeenCalledWith(getCourseCacheTag(edition.id), { expire: 0 });
    },
  );

  it.each([
    { country: "US" },
    { editionCountry: "DE" },
    { missingCourse: true },
    { firstPlan: false },
    { existing: "both" as const },
    { multiple: true },
    { visibility: "private" as const },
  ])("keeps the existing families when the edition is ineligible: %j", async (input) => {
    const { edition, original, source } = await resolvedPair(input);

    expect([source.familyId, edition.familyId]).toStrictEqual(original);
  });

  it("leaves a course unlinked when two different sources resolve to it", async () => {
    const [user, source, other, edition] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true }),
      courseFixture({ isPublished: true }),
      courseFixture({ isPublished: true, language: "pt" }),
    ]);

    await Promise.all(
      [source, other].map(async (origin) => {
        const goal = await goalFixture({
          language: "pt",
          primaryCourseId: edition.id,
          sourceCourseId: origin.id,
          userId: user.id,
        });

        await planFixture({
          goalId: goal.id,
          graph: {
            editionCandidate: true,
            skills: [
              {
                courseIds: [edition.id],
                lessons: 1,
                name: "Study",
                phase: 0,
                skillId: randomUUID(),
              },
            ],
          },
        });
      }),
    );

    await linkResolvedCourseEdition({ courseId: edition.id });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: edition.id } }),
    ).resolves.toMatchObject({ familyId: null });
  });
});
