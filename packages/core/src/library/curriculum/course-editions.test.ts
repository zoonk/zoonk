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
  multiple = false,
  published = false,
  visibility = "public",
}: {
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
      familyId: existing === "source" || existing === "both" ? first.id : null,
      isPublished: true,
    }),
    courseFixture({
      familyId: existing === "edition" || existing === "both" ? second.id : null,
      isPublished: published,
      language: "pt-BR",
      outlineStatus: "pending",
      visibility,
    }),
  ]);

  const goal = await goalFixture({
    details: { courseStartSourceId: source.id },
    language: "pt",
    primaryCourseId: edition.id,
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: {
      skills: [
        {
          courseIds: multiple ? [edition.id, randomUUID()] : [edition.id],
          lessons: 1,
          name: "Study",
          phase: 0,
          skillId: randomUUID(),
        },
      ],
    },
  });

  const runId = randomUUID();

  if (published) {
    await linkResolvedCourseEdition({ goalId: goal.id });
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

  it.each([{ existing: "both" as const }, { multiple: true }, { visibility: "private" as const }])(
    "keeps the existing families when the edition is ineligible: %j",
    async (input) => {
      const { edition, original, source } = await resolvedPair(input);

      expect([source.familyId, edition.familyId]).toStrictEqual(original);
    },
  );
});
