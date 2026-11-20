import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  approve,
  proposeFix,
  revertInAdmin,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

const skillName = "Imparcialidade e conflito de interesses";
const provision = "Lei nº 12.813/2013, art. 4º, § 1º";

const plan: LessonSpec = {
  canDo: "Reconhecer um conflito de interesses.",
  description: "Imparcialidade no serviço público.",
  estimatedMinutes: 2,
  screens: (["hook", "explanation", "application"] as const).map((kind) => ({
    activityTemplate: null,
    brief: kind === "explanation" ? provision : "Identificar um conflito de interesses.",
    kind,
    skills: [0],
    visual: null,
    visualKind: "none",
  })),
  skills: [
    {
      description: "Reconhecer um conflito de interesses.",
      example: "Uma decisão que afeta um familiar.",
      hard: false,
      name: skillName,
      topic: "Ética",
      useCase: "Uma decisão no serviço público.",
    },
  ],
  title: skillName,
};

const provenance = { plannedAt: "2026-11-01T00:00:00.000Z", sourcedProvisions: true };

function fixPlan(id: string, setPlan: object) {
  return { changes: [{ id, model: "Lesson", setPlan }], reason: "Correct the lesson plan." };
}

const savedPlan = { ...plan, ...provenance };

async function lessonWithPlan(spec: object = savedPlan) {
  const [lesson, skill] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed", estimatedMinutes: 2, spec }),
    skillFixture({ name: skillName }),
  ]);

  const [step] = await Promise.all([
    libraryStepFixture({ lessonId: lesson.id }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  return { lesson, step };
}

function readLesson(id: string) {
  return prisma.lesson.findUniqueOrThrow({ where: { id } });
}

describe("Lesson setPlan", () => {
  it("applies and reverts a one-character law correction without changing the live screens", async () => {
    const { lesson, step } = await lessonWithPlan();

    const corrected = {
      ...plan,
      screens: plan.screens.map((screen) => ({
        ...screen,
        brief: screen.brief.replace("§ 1º", "§ 2º"),
      })),
    };

    await signInProposer();

    const fix = await proposeFix(
      fixPlan(lesson.id, { ...corrected, estimatedMinutes: 50, plannedAt: "client" }),
    );

    expect(fix.effects).toStrictEqual([{ kind: "planChanged", lessonId: lesson.id }]);
    await expect(readLesson(lesson.id)).resolves.toMatchObject({ spec: lesson.spec });

    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      estimatedMinutes: 2,
      spec: { ...corrected, ...provenance },
      updatedAt: lesson.updatedAt,
    });

    const inverse = await revertInAdmin({ fixId: fix.id, reason: "Restore the original plan." });
    expect(inverse).toMatchObject({ status: "proposed" });

    if (inverse.status !== "proposed") {
      throw new Error("Expected a revert proposal");
    }

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({ spec: lesson.spec });

    await expect(prisma.step.findMany({ where: { lessonId: lesson.id } })).resolves.toStrictEqual([
      step,
    ]);
  });

  it("accepts a correction when an existing plan issue remains", async () => {
    const legacy = { ...plan, screens: plan.screens.slice(1) };
    const { lesson } = await lessonWithPlan(legacy);

    await signInProposer();
    const fix = await proposeFix(fixPlan(lesson.id, { ...legacy, description: "Ética pública." }));
    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      spec: { ...legacy, description: "Ética pública." },
    });
  });

  it("refuses an introduced plan issue and an unresolved skill rename", async () => {
    const { lesson } = await lessonWithPlan();
    await signInProposer();

    await expect(
      proposeContentFix(fixPlan(lesson.id, { ...plan, screens: plan.screens.slice(1) })),
    ).resolves.toMatchObject({ message: expect.stringContaining("hook"), status: "invalid" });

    await expect(
      proposeContentFix(
        fixPlan(lesson.id, {
          ...plan,
          skills: plan.skills.map((skill) => ({ ...skill, name: "Unlinked skill" })),
        }),
      ),
    ).resolves.toMatchObject({
      message: expect.stringContaining("Unlinked skill"),
      status: "invalid",
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({ spec: lesson.spec });
  });

  it("changes a challenge plan and keeps its lesson estimate", async () => {
    const challenge = {
      kind: "challenge",
      skills: [{ description: null, name: skillName }],
      variant: "work",
    };

    const { lesson } = await lessonWithPlan(challenge);

    const corrected = {
      ...challenge,
      skills: [{ description: "Reconhecer um conflito de interesses.", name: skillName }],
    };

    await signInProposer();
    const fix = await proposeFix(fixPlan(lesson.id, corrected));
    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      estimatedMinutes: lesson.estimatedMinutes,
      spec: corrected,
    });
  });

  it("recomputes both estimates when screen kinds change", async () => {
    const { lesson } = await lessonWithPlan();

    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const dependent = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: lesson.id, planId: dependent.id });

    const readDependent = () => prisma.plan.findUniqueOrThrow({ where: { id: dependent.id } });

    const corrected = {
      ...plan,
      screens: [
        ...plan.screens.slice(0, 2),
        ...Array.from({ length: 3 }, () => ({ ...plan.screens[1], kind: "workedExample" })),
        plan.screens[2],
      ],
    };

    await signInProposer();
    const fix = await proposeFix(fixPlan(lesson.id, corrected));
    expect(fix.effects).toContainEqual({ kind: "lessonVersion", lessonId: lesson.id });
    const { key } = await signInApprover();

    await expect(approve({ fixId: fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      estimatedMinutes: 3,
      spec: { ...corrected, estimatedMinutes: 3 },
    });

    await expect(readDependent()).resolves.toMatchObject({
      sourceVersion: dependent.sourceVersion + 1,
    });

    const inverse = await revertInAdmin({
      fixId: fix.id,
      reason: "Restore the original estimate.",
    });

    if (inverse.status !== "proposed") {
      throw new Error(JSON.stringify(inverse));
    }

    await expect(approve({ fixId: inverse.fix.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      estimatedMinutes: lesson.estimatedMinutes,
    });

    await expect(readDependent()).resolves.toMatchObject({
      sourceVersion: dependent.sourceVersion + 2,
    });
  });

  it("makes approval stale after another approved fix changes the plan", async () => {
    const { lesson } = await lessonWithPlan();
    await signInProposer();
    const first = await proposeFix(fixPlan(lesson.id, { ...plan, description: "Ética pública." }));
    const second = await proposeFix(fixPlan(lesson.id, { ...plan, description: "Lei aplicável." }));

    const { key } = await signInApprover();

    await expect(approve({ fixId: first.id, key })).resolves.toMatchObject({
      fix: { status: "applied" },
    });

    await expect(approve({ fixId: second.id, key })).resolves.toMatchObject({
      fix: { status: "stale" },
    });

    await expect(readLesson(lesson.id)).resolves.toMatchObject({
      spec: { description: "Ética pública." },
    });
  });
});
