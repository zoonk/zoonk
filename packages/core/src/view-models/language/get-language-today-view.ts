import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findDuePronunciationReviews } from "../../language/pronunciation/get-pronunciation-reviews";
import { loadDoneUnitIds } from "../../language/units/can-do-events";
import { getUnitFinishedAt } from "../../language/units/language-units";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
import { toCurrentUnit } from "./get-language-progress-view";
import { type LanguageTodayView } from "./language-view-contract";

/** A new "I can" and a noticed pattern stay on Today for a week. */
const FRESH_DAYS = 7;

/** Words named on the pronunciation row; the count covers the rest. */
const NAMED_WORDS = 3;

export type LanguageTodayViewResult =
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; today: LanguageTodayView };

/** Mispronounced words due to be said again, named by the first few. */
async function loadDuePronunciation({ language, userId }: { language: string; userId: string }) {
  const due = await findDuePronunciationReviews({ language, now: new Date(), userId });

  if (due.length === 0) {
    return null;
  }

  return { count: due.length, words: due.slice(0, NAMED_WORDS).map((review) => review.word.word) };
}

/**
 * What Today adds for a language goal, in both modes: the unit the learner is in with its
 * lessons done, a new "I can" from a unit finished this week, a pattern noticed in recent
 * mistakes that wasn't practiced yet, and the words to say again today.
 */
export async function getLanguageTodayView(
  input: { goalId?: string } = {},
): Promise<LanguageTodayViewResult> {
  "use cache: private";

  const loaded = await loadLanguageGoalContext(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { goal, units, userId } = loaded.context;
  const since = new Date(Date.now() - FRESH_DAYS * MS_PER_DAY);

  const newest = units
    .map((unit) => ({ finishedAt: getUnitFinishedAt(unit), unit }))
    .filter(({ finishedAt }) => finishedAt !== null && finishedAt >= since)
    .toSorted((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))[0];

  const [pattern, pronunciation, doneIds] = await Promise.all([
    prisma.mistakePattern.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, title: true },
      where: {
        createdAt: { gte: since },
        dismissedAt: null,
        language: goal.targetLanguage,
        practicedAt: null,
        userId,
      },
    }),
    loadDuePronunciation({ language: goal.targetLanguage, userId }),
    loadDoneUnitIds({ units, userId }),
  ]);

  return {
    status: "ready",
    today: {
      currentUnit: toCurrentUnit({ doneIds, units }),
      newCanDo: newest?.unit.objectives[0] ?? null,
      pattern,
      pronunciation,
    },
  };
}
