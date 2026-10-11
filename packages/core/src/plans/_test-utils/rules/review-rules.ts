import { toIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RuleViolation } from "./rule-context";
import { listTakenOut } from "./rule-items";

type FinishedLesson = NonNullable<RuleContext["finishedLessons"]>[number];

/**
 * The study sessions from a lesson's promised day it may take to come back: a day's reviews have a
 * cap, so a full day may hold it to the next one.
 */
const COMES_BACK_WITHIN_SESSIONS = 2;

/**
 * Whether a finished lesson is past the sessions it had to come back in and none of the sessions
 * after the day it was finished, up to the last of them, asked a skill it trained.
 */
function isLeftWaiting({
  lesson,
  sessions,
}: {
  lesson: FinishedLesson;
  sessions: NonNullable<RuleContext["sessions"]>;
}): boolean {
  const { comesBackOn, day, skillIds } = lesson;

  if (!comesBackOn) {
    return false;
  }

  const since = sessions.filter((session) => session.day > day);
  const promised = since.filter((session) => session.day >= comesBackOn);
  const deadline = promised[COMES_BACK_WITHIN_SESSIONS - 1];

  if (!deadline) {
    return false;
  }

  return !since
    .filter((session) => session.day <= deadline.day)
    .some((session) => session.practiceSkillIds.some((skillId) => skillIds.includes(skillId)));
}

/**
 * R42. A finished lesson comes back when its end screen said: by the second session on or after
 * that day, one of the sessions since the day the learner finished it asked a skill it trained, in
 * a review or in practice. A lesson of an area the learner took out is left out: practice leaves
 * that area out.
 */
export function checkFinishedLessonsComeBack(context: RuleContext): RuleViolation[] {
  const { after, finishedLessons, sessions } = context;

  if (!finishedLessons || !sessions) {
    return [];
  }

  const takenOut = listTakenOut(after);

  return finishedLessons
    .filter((lesson) => !lesson.skillIds.some((skillId) => takenOut.has(skillId)))
    .filter((lesson) => isLeftWaiting({ lesson, sessions }))
    .map(({ comesBackOn, day, lessonId }) => ({
      details: {
        comesBackOn: comesBackOn && toIsoDate(comesBackOn),
        day: toIsoDate(day),
        lessonId,
      },
      message: "A finished lesson didn't come back by the day its end screen said.",
      rule: "R42",
    }));
}
