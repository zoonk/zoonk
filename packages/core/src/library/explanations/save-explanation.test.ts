import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getExplanation } from "../../view-models/explain/get-explanation";
import { createLibraryLesson } from "../lessons/create-library-lesson";
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
  workflowRunId = randomUUID(),
}: {
  ownerId: string | null;
  skillId: string;
  workflowRunId?: string;
}) {
  const explanation = marketExplanation();

  return saveExplanationLesson({
    explanation,
    provenance,
    scope: { language: "en", ownerId },
    skillId,
    steps: toExplanationSteps(explanation).steps,
    workflowRunId,
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

  it.each(["current skill", "merged alias"] as const)(
    "marks creation and publication separately for plans retaining the %s, never on replay",
    async (dependency) => {
      const [owner, other, unrelated, skill] = await Promise.all([
        userFixture(),
        userFixture(),
        userFixture(),
        skillFixture(),
      ]);

      const graphSkill =
        dependency === "merged alias" ? await skillFixture({ mergedIntoId: skill.id }) : skill;

      const goals = await Promise.all([
        goalFixture({ userId: owner.id }),
        goalFixture({ userId: owner.id }),
        goalFixture({ userId: other.id }),
        goalFixture({ userId: unrelated.id }),
      ]);

      const plans = await Promise.all(
        goals.map((goal, index) =>
          planFixture({
            goalId: goal.id,
            graph: { skills: index < 3 ? [{ skillId: graphSkill.id }] : [] },
            sourceSkillIds: index < 3 ? [graphSkill.id] : [],
          }),
        ),
      );

      async function expectMarks(writes: number) {
        await expect(readRevision(owner.id)).resolves.toBe(BigInt(writes));
        await expect(readRevision(other.id)).resolves.toBe(BigInt(writes));
        await expect(readRevision(unrelated.id)).resolves.toBe(0n);

        const updated = await prisma.plan.findMany({
          where: { id: { in: plans.map((plan) => plan.id) } },
        });

        expect(
          plans.map((plan) => {
            const current = updated.find((row) => row.id === plan.id);

            return { inputVersion: current?.inputVersion, version: current?.version };
          }),
        ).toStrictEqual(
          plans.map((plan, index) => ({
            inputVersion: plan.inputVersion + (index < 3 ? writes : 0),
            version: plan.version,
          })),
        );
      }

      const explanation = marketExplanation();

      const outline = await createLibraryLesson({
        description: explanation.screens[0]?.title ?? explanation.title,
        estimatedMinutes: 4,
        homeChapterId: null,
        identityKey: scopeIdentityKey({
          key: buildLessonIdentityKey({
            courseId: null,
            level: "overview",
            skillIds: [skill.id],
            targetLanguage: null,
          }),
          ownerId: null,
        }),
        language: "en",
        level: "overview",
        ownerId: null,
        provenance,
        skillIds: [skill.id],
        targetLanguage: null,
        title: explanation.title,
      });

      expect(outline.created).toBe(true);
      expect(outline.lesson.contentStatus).toBe("pending");
      await expectMarks(1);

      const saved = await saveMarketExplanation({ ownerId: null, skillId: skill.id });
      expect(saved).toStrictEqual({ lessonId: outline.lesson.id, status: "saved" });
      await expectMarks(2);

      await expect(
        prisma.lesson.findUniqueOrThrow({ where: { id: outline.lesson.id } }),
      ).resolves.toMatchObject({ contentStatus: "completed" });

      await expect(
        saveMarketExplanation({ ownerId: null, skillId: skill.id }),
      ).resolves.toStrictEqual({ lessonId: saved.lessonId, status: "reused" });

      await expectMarks(2);
    },
  );

  it("rolls back publication markers when a real generation claim is lost while waiting for a plan lock", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const saved = await saveMarketExplanation({ ownerId: null, skillId: skill.id });
    const goal = await goalFixture({ userId: user.id });

    const plan = await planFixture({
      goalId: goal.id,
      graph: { skills: [{ skillId: skill.id }] },
      sourceSkillIds: [skill.id],
    });

    await prisma.lesson.update({
      data: { contentStatus: "failed" },
      where: { id: saved.lessonId },
    });

    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${plan.id}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(backend?.pid ?? 0);
      await release.promise;
    });

    const holderPid = await ready.promise;
    const workflowRunId = randomUUID();
    const publishing = saveMarketExplanation({ ownerId: null, skillId: skill.id, workflowRunId });

    try {
      await vi.waitFor(async () => {
        const [waiting] = await prisma.$queryRaw<{ blocked: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))) AS blocked
        `;

        expect(waiting?.blocked).toBe(true);
      });

      await prisma.lesson.update({
        data: { contentRunId: randomUUID() },
        where: { id: saved.lessonId },
      });
    } finally {
      release.resolve(null);
      await holder;
    }

    await expect(publishing).resolves.toStrictEqual({ lessonId: saved.lessonId, status: "busy" });
    await expect(readRevision(user.id)).resolves.toBe(0n);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
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
      aiOrganizationFixture(),
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

    // Building the explain plan marks only that plan; a goal source change marks all of the
    // learner's plans, so their other plan shows it.
    const otherGoal = await goalFixture({ userId: user.id });
    const otherPlan = await planFixture({ goalId: otherGoal.id });

    await linkExplanationToGoal({
      courseId: course.id,
      goalId: goal.id,
      relatedQuestions: marketExplanation().goFurther.relatedQuestions,
      skill: { id: skill.id, name: skill.name },
      title: "What “the market is up 2%” means",
    });

    // The Overview course became the goal's main course: a goal source the plan reads.
    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toMatchObject({ inputVersion: otherPlan.inputVersion + 1 });

    const revisionBefore = await readRevision(user.id);

    await linkExplanationToGoal({
      courseId: course.id,
      goalId: goal.id,
      relatedQuestions: ["A new follow-up"],
      skill: { id: skill.id, name: skill.name },
      title: "What “the market is up 2%” means",
    });

    await expect(readRevision(user.id)).resolves.toBe(revisionBefore + 1n);

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
  });
});

describe(linkGoFurtherCourse, () => {
  it("links the course to go further after the explanation, never replacing one already linked", async () => {
    const [{ goal, user }, skill, organization] = await Promise.all([
      explainGoal(),
      skillFixture(),
      aiOrganizationFixture(),
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

    const revisionBefore = await readRevision(user.id);
    const readPlan = () => prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    const planBefore = await readPlan();

    await linkGoFurtherCourse({ courseId: first.id, goalId: goal.id, lessonId: saved.lessonId });
    await expect(readRevision(user.id)).resolves.toBe(revisionBefore + 1n);
    await expect(readPlan()).resolves.toMatchObject({ inputVersion: planBefore.inputVersion + 1 });
    await linkGoFurtherCourse({ courseId: second.id, goalId: goal.id, lessonId: saved.lessonId });
    await expect(readRevision(user.id)).resolves.toBe(revisionBefore + 1n);

    await expect(getExplanation({ goalId: goal.id })).resolves.toMatchObject({
      explanation: { goFurther: { course: { title: "Investing" } } },
    });

    await expect(findExplanationGoFurther(saved.lessonId)).resolves.toMatchObject({
      courseId: first.id,
    });
  });
});

describe(findExplanationGoFurther, () => {
  it("gives the next learner the way to go further after the first asker is deleted", async () => {
    const [{ goal, user }, skill, organization] = await Promise.all([
      explainGoal(),
      skillFixture(),
      aiOrganizationFixture(),
    ]);

    const [course, saved] = await Promise.all([
      courseFixture({ organizationId: organization.id, title: "Markets", visibility: "public" }),
      saveMarketExplanation({ ownerId: null, skillId: skill.id }),
    ]);

    await linkExplanationToGoal({
      courseId: null,
      goalId: goal.id,
      relatedQuestions: marketExplanation().goFurther.relatedQuestions,
      skill: { id: skill.id, name: skill.name },
      title: "What “the market is up 2%” means",
    });

    await linkGoFurtherCourse({ courseId: course.id, goalId: goal.id, lessonId: saved.lessonId });
    await prisma.user.delete({ where: { id: user.id } });

    await expect(findExplanationGoFurther(saved.lessonId)).resolves.toStrictEqual({
      courseId: course.id,
      relatedQuestions: ["What is an index fund?", "Why do stocks fall?"],
    });
  });

  it("passes on only a shared course", async () => {
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const [course, saved] = await Promise.all([
      courseFixture({ userId: user.id, visibility: "private" }),
      saveMarketExplanation({ ownerId: null, skillId: skill.id }),
    ]);

    await prisma.lesson.update({
      data: { goFurtherCourseId: course.id },
      where: { id: saved.lessonId },
    });

    await expect(findExplanationGoFurther(saved.lessonId)).resolves.toMatchObject({
      courseId: null,
    });
  });
});

async function readRevision(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.learnerRevision;
}
