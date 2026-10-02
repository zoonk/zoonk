import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getExplanation } from "../../view-models/explain/get-explanation";
import { marketExplanation } from "./_test-utils/market-explanation";
import { loadExplainGoal } from "./explain-goal";
import { toExplanationSteps } from "./explanation-steps";
import {
  findExplanationGoFurther,
  findExplanationLesson,
  linkExplanationToGoal,
  linkGoFurtherCourse,
  saveExplanationLesson,
} from "./save-explanation";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const provenance = {
  generatedAt: new Date(),
  model: "openai/gpt-6-luna",
  promptVersion: "v1",
  runId: "run",
};

async function explainGoal() {
  const user = await userFixture();

  const goal = await goalFixture({
    details: { question: "what does it mean when the market is up 2%?" },
    kind: "explain",
    userId: user.id,
  });

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  return { goal, user };
}

async function saveMarketExplanation({
  ownerId,
  skillId,
}: {
  ownerId: string | null;
  skillId: string;
}) {
  const explanation = marketExplanation();

  return saveExplanationLesson({
    explanation,
    provenance,
    scope: { language: "en", ownerId },
    skillId,
    steps: toExplanationSteps(explanation).steps,
    workflowRunId: randomUUID(),
  });
}

describe(saveExplanationLesson, () => {
  it("stores the explanation once as an overview lesson for the question skill, then reuses it", async () => {
    const skill = await skillFixture();

    const saved = await saveMarketExplanation({ ownerId: null, skillId: skill.id });
    const again = await saveMarketExplanation({ ownerId: null, skillId: skill.id });

    expect(saved.status).toBe("saved");
    expect(again).toStrictEqual({ lessonId: saved.lessonId, status: "reused" });

    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { steps: { orderBy: { position: "asc" } } },
      where: { id: saved.lessonId },
    });

    expect(lesson).toMatchObject({
      contentStatus: "completed",
      level: "overview",
      title: "What “the market is up 2%” means",
      visibility: "public",
    });

    expect(lesson.steps.map((step) => step.kind)).toStrictEqual([
      "explanation",
      "explanation",
      "explanation",
      "explanation",
      "check",
      "summary",
    ]);

    expect(lesson.steps.every((step) => step.skillId === skill.id)).toBe(true);

    await expect(findExplanationLesson({ ownerId: null, skillId: skill.id })).resolves.toBe(
      saved.lessonId,
    );
  });

  it("keeps a personal question's explanation private to its learner", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const skill = await skillFixture({ ownerId: user.id, visibility: "private" });

    const saved = await saveMarketExplanation({ ownerId: user.id, skillId: skill.id });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: saved.lessonId } }),
    ).resolves.toMatchObject({ ownerId: user.id, visibility: "private" });

    await expect(
      findExplanationLesson({ ownerId: other.id, skillId: skill.id }),
    ).resolves.toBeNull();
  });
});

describe(linkExplanationToGoal, () => {
  it("gives the explain screen its lesson, recap, Overview course and related questions", async () => {
    const [{ goal, user }, skill, organization] = await Promise.all([
      explainGoal(),
      skillFixture(),
      prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } }),
    ]);

    const [course, saved] = await Promise.all([
      courseFixture({
        organizationId: organization.id,
        title: "How the stock market works",
        visibility: "public",
      }),
      saveMarketExplanation({ ownerId: null, skillId: skill.id }),
    ]);

    await expect(loadExplainGoal(goal.id)).resolves.toMatchObject({
      answered: false,
      question: "what does it mean when the market is up 2%?",
    });

    await linkExplanationToGoal({
      courseId: course.id,
      goalId: goal.id,
      relatedQuestions: marketExplanation().goFurther.relatedQuestions,
      skill: { id: skill.id, name: skill.name },
      title: "What “the market is up 2%” means",
    });

    await expect(loadExplainGoal(goal.id)).resolves.toMatchObject({ answered: true });
    mockSession(user.id);

    const result = await getExplanation({ goalId: goal.id });

    expect(result).toMatchObject({
      explanation: {
        goFurther: {
          course: { courseSlug: course.slug, title: "How the stock market works" },
          questions: ["What is an index fund?", "Why do stocks fall?"],
        },
        lesson: { id: saved.lessonId },
        recap: [
          "The market is an index.",
          "Big companies weigh more.",
          "Up 2% compares with yesterday's close.",
        ],
        status: "ready",
      },
      status: "ready",
    });

    await expect(findExplanationGoFurther(saved.lessonId)).resolves.toStrictEqual({
      courseId: course.id,
      relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
    });
  });
});

describe(linkGoFurtherCourse, () => {
  it("links the course to go further after the explanation, never replacing one already linked", async () => {
    const [{ goal, user }, skill, organization] = await Promise.all([
      explainGoal(),
      skillFixture(),
      prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } }),
    ]);

    const [first, second, saved] = await Promise.all([
      courseFixture({ organizationId: organization.id, title: "Investing", visibility: "public" }),
      courseFixture({ organizationId: organization.id, title: "Economics", visibility: "public" }),
      saveMarketExplanation({ ownerId: null, skillId: skill.id }),
    ]);

    await linkExplanationToGoal({
      courseId: null,
      goalId: goal.id,
      relatedQuestions: marketExplanation().goFurther.relatedQuestions,
      skill: { id: skill.id, name: skill.name },
      title: "What “the market is up 2%” means",
    });

    mockSession(user.id);

    // The learner reads the explanation before its course to go further is found.
    await expect(getExplanation({ goalId: goal.id })).resolves.toMatchObject({
      explanation: { goFurther: { course: null }, lesson: { id: saved.lessonId }, status: "ready" },
    });

    await linkGoFurtherCourse({ courseId: first.id, goalId: goal.id });
    await linkGoFurtherCourse({ courseId: second.id, goalId: goal.id });

    await expect(getExplanation({ goalId: goal.id })).resolves.toMatchObject({
      explanation: { goFurther: { course: { title: "Investing" } } },
    });
  });
});
