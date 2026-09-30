import { prisma } from "@zoonk/db";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";

type LessonSteps = NonNullable<Parameters<typeof playableLessonFixture>[0]>["steps"];

/**
 * A learner (or guest) in the session and a written Library lesson teaching one skill. Tests that
 * start runs need their own learner, since runs and answers persist.
 */
export async function setupPlayableLesson({
  guest = false,
  steps,
}: { guest?: boolean; steps?: LessonSteps } = {}) {
  const [user, skill, created] = await Promise.all([
    userFixture(),
    skillFixture(),
    playableLessonFixture({ steps }),
  ]);

  await Promise.all([
    lessonSkillFixture({ lessonId: created.lesson.id, skillId: skill.id }),
    guest && prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } }),
  ]);

  if (guest) {
    mockGuestSession(user.id);
  } else {
    mockSession(user.id);
  }

  return { ...created, skill, user };
}

/** The screen of a lesson with this kind; fails the test when the lesson has none. */
export function stepOfKind<TStep extends { kind: string }>(steps: TStep[], kind: string): TStep {
  const step = steps.find((item) => item.kind === kind);

  if (!step) {
    throw new Error(`Expected a ${kind} step`);
  }

  return step;
}
