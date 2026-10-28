import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { getLessonSupport } from "./get-lesson-support";
import { startLibraryLesson } from "./start-library-lesson";

async function setupLesson() {
  const [user, opening, other] = await Promise.all([userFixture(), skillFixture(), skillFixture()]);

  const { lesson, steps } = await playableLessonFixture({
    steps: [
      "hook",
      { kind: "explanation", skillId: opening.id },
      { kind: "check", skillId: opening.id },
      { kind: "explanation", skillId: other.id },
    ],
  });

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: opening.id }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: other.id }),
  ]);

  mockSession(user.id);

  return { lesson, opening, other, steps, user };
}

describe(getLessonSupport, () => {
  it("opens with the explanation for a learner who never answered the opening skill", async () => {
    const { lesson, other, user } = await setupLesson();

    await learnerSkillFixture({ reps: 3, skillId: other.id, userId: user.id });

    await expect(getLessonSupport({ lessonId: lesson.id })).resolves.toBe("explanationFirst");
  });

  it("opens with a question once the learner answered the opening skill, also in the run", async () => {
    const { lesson, opening, user } = await setupLesson();
    await learnerSkillFixture({ reps: 1, skillId: opening.id, userId: user.id });

    await expect(getLessonSupport({ lessonId: lesson.id })).resolves.toBe("questionFirst");

    const started = await startLibraryLesson({
      input: { timeZone: "America/Sao_Paulo" },
      lessonId: lesson.id,
    });

    expect(started.status === "started" && started.run.support).toBe("questionFirst");
  });

  it.each([false, true])(
    "keeps the opening order after a first answer (reset skill: %s)",
    async (resetSkill) => {
      const { lesson, opening, steps, user } = await setupLesson();

      if (resetSkill) {
        await learnerSkillFixture({ reps: 0, skillId: opening.id, userId: user.id });
      }

      const started = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

      expect(started.status).toBe("started");

      if (started.status !== "started") {
        throw new Error("Expected the lesson to start");
      }

      expect(started.run.support).toBe("explanationFirst");

      const check = steps.find((step) => step.kind === "check");

      if (!check) {
        throw new Error("Expected the opening check");
      }

      await expect(
        checkLessonStep({
          input: {
            answer: { kind: "check", optionId: "likely" },
            durationMs: 8000,
            runId: started.run.runId,
            timeZone: "UTC",
          },
          stepId: check.id,
        }),
      ).resolves.toMatchObject({ status: "checked" });

      await expect(getLessonSupport({ lessonId: lesson.id })).resolves.toBe("explanationFirst");

      await expect(
        startLibraryLesson({
          input: { runId: started.run.runId, timeZone: "UTC" },
          lessonId: lesson.id,
        }),
      ).resolves.toMatchObject({ run: { support: "explanationFirst" }, status: "started" });

      await prisma.learningEvent.update({
        data: { startedAt: new Date(Date.now() - 31 * 60_000) },
        where: { id: started.run.runId },
      });

      const later = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

      expect(later.status).toBe("started");

      if (later.status !== "started") {
        throw new Error("Expected the later sitting to start");
      }

      expect(later.run.runId).not.toBe(started.run.runId);
      expect(later.run.support).toBe("explanationFirst");
      await expect(getLessonSupport({ lessonId: lesson.id })).resolves.toBe("explanationFirst");

      await expect(
        completeLibraryLesson({
          input: { runId: later.run.runId, timeZone: "UTC" },
          lessonId: lesson.id,
        }),
      ).resolves.toMatchObject({ status: "completed" });

      await expect(getLessonSupport({ lessonId: lesson.id })).resolves.toBe("questionFirst");

      await expect(
        startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id }),
      ).resolves.toMatchObject({ run: { support: "questionFirst" }, status: "started" });
    },
  );

  it("uses the lesson's skills when no screen names one, and keeps the order without skills", async () => {
    const [user, skill, withSkill, withoutSkills] = await Promise.all([
      userFixture(),
      skillFixture(),
      playableLessonFixture({ steps: ["hook", "explanation", "check"] }),
      playableLessonFixture({ steps: ["hook", "explanation", "check"] }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: withSkill.lesson.id, skillId: skill.id }),
      learnerSkillFixture({ reps: 2, skillId: skill.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(getLessonSupport({ lessonId: withSkill.lesson.id })).resolves.toBe(
      "questionFirst",
    );

    await expect(getLessonSupport({ lessonId: withoutSkills.lesson.id })).resolves.toBeNull();
  });

  it("keeps the lesson's order without a session or a lesson id", async () => {
    const { lesson } = await setupLesson();

    await expect(getLessonSupport({ lessonId: "not-a-uuid" })).resolves.toBeNull();

    mockSession(null);
    await expect(getLessonSupport({ lessonId: lesson.id })).resolves.toBeNull();
    await expect(getLessonSupport({ lessonId: randomUUID() })).resolves.toBeNull();
  });
});
