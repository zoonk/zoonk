import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getSpeakingMockExam } from "../../exams/language-exam";
import { readGoalDetails } from "../../language/_utils/language-goal";
import {
  getTargetLevel,
  loadLanguageSkillLevels,
} from "../../language/levels/language-skill-levels";
import { loadDoneUnitIds } from "../../language/units/can-do-events";
import { type LanguageUnit, findCurrentUnit } from "../../language/units/language-units";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type LanguageGoalContext, loadLanguageGoalContext } from "./_utils/language-goal-context";
import { type LanguageProgressView } from "./language-view-contract";

/** "In the last four weeks", as Progress says it. */
const RECENT_DAYS = 28;
const MS_PER_MINUTE = 60_000;
const SECONDS_PER_MINUTE = 60;

/** Finished units shown in "I can already", newest last, beside the current unit's checks. */
const DONE_UNITS_SHOWN = 2;

export type LanguageProgressViewResult =
  | { progress: LanguageProgressView; status: "ready" }
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" };

type UnitProgress = { doneIds: ReadonlySet<string>; units: readonly LanguageUnit[] };

/** The current unit as Today and Progress show it: "Renting an apartment, 4 of 9". */
export function toCurrentUnit({ doneIds, units }: UnitProgress) {
  const unit = findCurrentUnit({ doneIds, units });

  if (!unit) {
    return null;
  }

  return {
    chapterId: unit.chapterId,
    lessonsDone: unit.lessons.filter((lesson) => lesson.done).length,
    lessonsTotal: unit.lessons.length,
    position: unit.position,
    title: unit.title,
    units: units.length,
  };
}

function getCanDo({ doneIds, units }: UnitProgress) {
  const current = findCurrentUnit({ doneIds, units });
  const ahead = current && !doneIds.has(current.chapterId) ? current : null;
  const done = units.filter((unit) => doneIds.has(unit.chapterId)).slice(-DONE_UNITS_SHOWN);

  return [
    ...done.flatMap((unit) =>
      unit.objectives.map((text) => ({ done: true, text, unitTitle: unit.title })),
    ),
    ...(ahead?.objectives.map((text) => ({ done: false, text, unitTitle: ahead.title })) ?? []),
  ];
}

/**
 * Minutes spoken, conversations held and words learned in the last four weeks in the goal's
 * language, all from the learner's own rows: calls and spoken answers each carry the language
 * they practiced.
 */
async function loadRecent({ goal, userId }: LanguageGoalContext) {
  const since = new Date(Date.now() - RECENT_DAYS * MS_PER_DAY);
  const language = goal.targetLanguage;

  const [calls, spoken, wordsLearned] = await Promise.all([
    prisma.languageConversation.aggregate({
      _count: true,
      _sum: { spokenSeconds: true },
      where: { endedAt: { gte: since }, status: "completed", targetLanguage: language, userId },
    }),
    prisma.attempt.aggregate({
      _sum: { durationMs: true },
      where: {
        answer: { equals: "spoken", path: ["kind"] },
        answeredAt: { gte: since },
        targetLanguage: language,
        userId,
      },
    }),
    prisma.learnerWord.count({ where: { language, learnedAt: { gte: since }, userId } }),
  ]);

  const minutes =
    (calls._sum.spokenSeconds ?? 0) / SECONDS_PER_MINUTE +
    (spoken._sum.durationMs ?? 0) / MS_PER_MINUTE;

  return { conversations: calls._count, minutesSpoken: Math.round(minutes), wordsLearned };
}

/** Words known is a total: every word ever learned in the language, not only this month's. */
function countWordsKnown({ goal, userId }: LanguageGoalContext) {
  return prisma.learnerWord.count({ where: { language: goal.targetLanguage, userId } });
}

/**
 * Progress for a language goal, the same in Focus and Fun: the level of each skill with how it
 * moved since the level test, the target, "I can already" checks from the units, the words known
 * and the last four weeks in words, minutes spoken and conversations.
 */
export async function getLanguageProgressView(
  input: { goalId?: string } = {},
): Promise<LanguageProgressViewResult> {
  "use cache: private";

  const loaded = await loadLanguageGoalContext(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { context } = loaded;
  const { goal, units, userId } = context;
  const details = readGoalDetails(goal);

  const [levels, doneIds, recent, wordsKnown] = await Promise.all([
    loadLanguageSkillLevels({ details, language: goal.targetLanguage, userId }),
    loadDoneUnitIds({ units, userId }),
    loadRecent(context),
    countWordsKnown(context),
  ]);

  return {
    progress: {
      canDo: getCanDo({ doneIds, units }),
      currentUnit: toCurrentUnit({ doneIds, units }),
      goal: {
        id: goal.id,
        targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
        targetLanguage: goal.targetLanguage,
        title: goal.title,
      },
      levels,
      recent,
      speakingMock: getSpeakingMockExam(goal),
      target: getTargetLevel(details),
      wordsKnown,
    },
    status: "ready",
  };
}
