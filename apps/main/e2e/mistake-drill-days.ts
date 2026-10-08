import { randomUUID } from "node:crypto";
import { type MistakeCause } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";

const MINUTE_MS = 60_000;

/** The drill a cause calls for, and a timed drill's seconds, as core's `selectMistakeDrill` has it. */
const DRILL_KINDS = {
  gap: "reteach",
  guess: "noGuessing",
  misread: "readCarefully",
  time: "timed",
  trap: "spotTheTrap",
} as const satisfies Record<MistakeCause, string>;

const TIMED_DRILL_SECONDS = 45;

/** The summary card of every drill's lesson: what a content gap's drill brings back first. */
export const LESSON_IDEA = "A discount comes off the price you pay.";

/** Every question's right option is the first one, "Right answer"; the second is a trap. */
export const TRAP = "Applies the rule backwards";

/** The question a cause's drill asks first, and the one it adds on the same skill. */
export function drillQuestion(cause: MistakeCause, which: "extra" | "original") {
  return `${cause} ${which === "original" ? "first" : "second"} question?`;
}

/** Where each cause's drill stands: its mistake, questions and lesson. */
async function createCauseDrill({
  cause,
  index,
  planId,
  userId,
}: {
  cause: MistakeCause;
  index: number;
  planId: string;
  userId: string;
}) {
  const [skill, lesson] = await Promise.all([
    skillFixture({ name: `${cause} ${randomUUID()}` }),
    libraryLessonFixture({
      summary: { ideas: [{ text: LESSON_IDEA }] },
      title: `Why ${cause} happens`,
    }),
  ]);

  const [original, extra] = await Promise.all([
    itemFixture({
      content: choiceItemContent(drillQuestion(cause, "original")),
      skillId: skill.id,
    }),
    itemFixture({ content: choiceItemContent(drillQuestion(cause, "extra")), skillId: skill.id }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    planItemFixture({ lessonId: lesson.id, planId, position: index, titleSnapshot: lesson.title }),
  ]);

  // Each cause is a minute newer than the one before, so practice drills them in the order given.
  const mistake = await mistakeFixture({
    cause,
    createdAt: new Date(Date.now() - MS_PER_DAY * 2 + index * MINUTE_MS),
    itemId: original.id,
    skillId: skill.id,
    snapshot: { answer: "Wrong answer", question: drillQuestion(cause, "original") },
    userId,
  });

  return { cause, extra, lesson, mistake, original, skill };
}

/**
 * A new learner, with nothing studied yet, whose goal has one open mistake from
 * yesterday per cause, each on its own skill with two questions and a lesson that teaches it.
 */
export async function createMistakeLearner({ causes }: { causes: MistakeCause[] }) {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [drills] = await Promise.all([
    Promise.all(
      causes.map((cause, index) =>
        createCauseDrill({ cause, index, planId: plan.id, userId: user.id }),
      ),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return { drills, goal, user };
}

type CauseDrill = Awaited<ReturnType<typeof createCauseDrill>>;

/** The drill today's session builds for a mistake, by its cause (see core's `selectMistakeDrill`). */
function toBlockDrill(drill: CauseDrill) {
  return {
    itemIds: [drill.original.id, drill.extra.id],
    kind: DRILL_KINDS[drill.cause],
    lessonId: drill.cause === "gap" ? drill.lesson.id : null,
    mistakeId: drill.mistake.id,
    timeLimitSeconds: drill.cause === "time" ? TIMED_DRILL_SECONDS : null,
  };
}

/** Today's session for the learner: one practice block of their mistakes' drills. */
export async function createDrillSession({ causes }: { causes: MistakeCause[] }) {
  const learner = await createMistakeLearner({ causes });
  const session = await studySessionFixture({ goalId: learner.goal.id, userId: learner.user.id });

  await studySessionBlockFixture({
    estimatedMinutes: 4,
    kind: "practice",
    payload: {
      drills: learner.drills.map((drill) => toBlockDrill(drill)),
      skillIds: learner.drills.map((drill) => drill.skill.id),
    },
    position: 0,
    sessionId: session.id,
  });

  return { ...learner, session };
}
