import "server-only";
import { type Activity, type Chapter, type Course, type Lesson, prisma } from "@zoonk/db";

/**
 * This module is the source of truth for curriculum lifecycle decisions.
 *
 * We agreed on a few product rules before touching delete flows:
 *
 * - Removing content from product surfaces is not the same as removing it from history.
 * - Current progress should reflect the current active curriculum.
 * - Historical learner performance must survive archive/regeneration decisions.
 * - These rules apply to both AI-managed and manually authored curriculum.
 *
 * The practical invariant for the codebase is simpler: only learner-touched
 * content must be archived. This helper intentionally does not look at published
 * status because publication alone does not create the history-retention problem
 * we are protecting against.
 */
export type ContentDeleteMode = "archive" | "hardDelete";
export type ContentDeleteConstraint = "learnerData";

type CourseDeleteTarget = {
  course: Pick<Course, "id">;
  entityType: "course";
};

type ChapterDeleteTarget = {
  chapter: Pick<Chapter, "id">;
  entityType: "chapter";
};

type LessonDeleteTarget = {
  entityType: "lesson";
  lesson: Pick<Lesson, "id">;
};

type ActivityDeleteTarget = {
  activity: Pick<Activity, "id">;
  entityType: "activity";
};

export type ContentDeleteTarget =
  | CourseDeleteTarget
  | ChapterDeleteTarget
  | LessonDeleteTarget
  | ActivityDeleteTarget;

/**
 * The delete decision stays intentionally small so delete handlers can branch on it
 * without re-implementing lifecycle policy. `constraints` explains why an entity is
 * archive-only.
 */
export type ContentDeleteDecision = {
  constraints: ContentDeleteConstraint[];
  mode: ContentDeleteMode;
};

/**
 * Centralizes the rules for when curriculum can be physically deleted.
 *
 * We need one shared decision point because later delete flows must agree on the
 * same invariant: only content with learner history must be archived. Published
 * but untouched content can still be hard-deleted because it does not erase any
 * historical learner facts.
 */
export async function getContentDeleteDecision(
  target: ContentDeleteTarget,
): Promise<ContentDeleteDecision> {
  const hasLearnerData = await hasLearnerDataConstraint(target);

  const constraints = getDeleteConstraints({ hasLearnerData });

  return {
    constraints,
    mode: constraints.length > 0 ? "archive" : "hardDelete",
  };
}

/**
 * Checks whether learners have produced durable history under the entity. We keep
 * this logic focused on historical facts because that is the only thing that
 * turns a safe hard delete into a destructive data-loss event.
 */
async function hasLearnerDataConstraint(target: ContentDeleteTarget): Promise<boolean> {
  switch (target.entityType) {
    case "course":
      return hasLearnerDataInCourse({ courseId: target.course.id });
    case "chapter":
      return hasLearnerDataInChapter({ chapterId: target.chapter.id });
    case "lesson":
      return hasLearnerDataInLesson({ lessonId: target.lesson.id });
    case "activity":
      return hasLearnerDataInActivity({ activityId: target.activity.id });
    default:
      return assertUnexpectedDeleteTarget(target);
  }
}

/**
 * Course deletes must switch to archive mode once any descendant activity
 * completion or step attempt exists, because those rows are the historical facts
 * later analytics and performance pages need to preserve.
 */
async function hasLearnerDataInCourse({ courseId }: { courseId: number }) {
  const [activityProgressCount, stepAttemptCount] = await Promise.all([
    prisma.activityProgress.count({
      where: { activity: { lesson: { chapter: { courseId } } } },
    }),
    prisma.stepAttempt.count({
      where: { step: { activity: { lesson: { chapter: { courseId } } } } },
    }),
  ]);

  return hasAnyCount({ counts: [activityProgressCount, stepAttemptCount] });
}

/**
 * Chapters share the same learner-history rule as courses, but their scope is
 * limited to activities and steps nested under that chapter.
 */
async function hasLearnerDataInChapter({ chapterId }: { chapterId: number }) {
  const [activityProgressCount, stepAttemptCount] = await Promise.all([
    prisma.activityProgress.count({
      where: { activity: { lesson: { chapterId } } },
    }),
    prisma.stepAttempt.count({
      where: { step: { activity: { lesson: { chapterId } } } },
    }),
  ]);

  return hasAnyCount({ counts: [activityProgressCount, stepAttemptCount] });
}

/**
 * Lessons need the same protection as higher levels because a later archive or
 * regeneration must not erase attempts and completions tied to that lesson.
 */
async function hasLearnerDataInLesson({ lessonId }: { lessonId: number }) {
  const [activityProgressCount, stepAttemptCount] = await Promise.all([
    prisma.activityProgress.count({ where: { activity: { lessonId } } }),
    prisma.stepAttempt.count({ where: { step: { activity: { lessonId } } } }),
  ]);

  return hasAnyCount({ counts: [activityProgressCount, stepAttemptCount] });
}

/**
 * Activities can accumulate two kinds of learner history today: direct activity
 * completions and step-level attempts. Either one is enough to block hard delete.
 */
async function hasLearnerDataInActivity({ activityId }: { activityId: bigint }) {
  const [activityProgressCount, stepAttemptCount] = await Promise.all([
    prisma.activityProgress.count({ where: { activityId } }),
    prisma.stepAttempt.count({ where: { step: { activityId } } }),
  ]);

  return hasAnyCount({ counts: [activityProgressCount, stepAttemptCount] });
}

/**
 * Keeps the existence checks declarative and avoids repeating `count > 0` branches
 * across every helper.
 */
function hasAnyCount({ counts }: { counts: number[] }) {
  return counts.some((count) => count > 0);
}

/**
 * Builds the reason list for archive-only decisions without relying on broad type
 * assertions. The helper keeps the public return type precise so callers can trust
 * that every constraint value is part of the supported vocabulary.
 */
function getDeleteConstraints({
  hasLearnerData,
}: {
  hasLearnerData: boolean;
}): ContentDeleteConstraint[] {
  const learnerConstraints: ContentDeleteConstraint[] = hasLearnerData ? ["learnerData"] : [];

  return learnerConstraints;
}

/**
 * Makes exhaustive switches explicit for both TypeScript and linting. If a new
 * delete target is added later, this throws immediately until the lifecycle rules
 * are updated to handle it.
 */
function assertUnexpectedDeleteTarget(target: never): never {
  throw new Error(`Unsupported content delete target: ${JSON.stringify(target)}`);
}
