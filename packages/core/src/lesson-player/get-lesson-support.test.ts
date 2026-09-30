import { randomUUID } from "node:crypto";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getLessonSupport } from "./get-lesson-support";
import { startLibraryLesson } from "./start-library-lesson";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

/** A lesson that opens (after its hook) with an explanation of `opening`, and also teaches `other`. */
async function setupLesson() {
  const [user, opening, other] = await Promise.all([userFixture(), skillFixture(), skillFixture()]);

  const { lesson } = await playableLessonFixture({
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

  return { lesson, opening, other, user };
}

describe(getLessonSupport, () => {
  it("opens with the explanation for a learner who never answered the opening skill", async () => {
    const { lesson, other, user } = await setupLesson();

    // Knowing a later skill of the lesson doesn't change how it opens.
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
