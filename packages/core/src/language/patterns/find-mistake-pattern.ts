import "server-only";
import { findMistakePattern } from "@zoonk/ai/tasks/v2/language/mistake-pattern";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { readMistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { findLearnerLanguageGoal } from "../_utils/language-goal";

/** Mistakes a check reads at most, newest first. */
const MAX_MISTAKES = 20;
/** A pattern needs a few new mistakes to look at; a check runs at every few new ones. */
const MISTAKES_PER_CHECK = 3;
/** Only recent mistakes: a pattern from months ago says little about today. */
const RECENT_DAYS = 14;

async function loadNewMistakes({ language, userId }: { language: string; userId: string }) {
  const latest = await prisma.mistakePattern.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: { language, userId },
  });

  const since = new Date(
    Math.max(Date.now() - RECENT_DAYS * MS_PER_DAY, latest?.createdAt.getTime() ?? 0),
  );

  return prisma.mistake.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, snapshot: true },
    take: MAX_MISTAKES,
    where: { createdAt: { gt: since }, step: { lesson: { targetLanguage: language } }, userId },
  });
}

async function checkForPattern({ language, userId }: { language: string; userId: string }) {
  const mistakes = await loadNewMistakes({ language, userId });

  // Every third new mistake, so a learner is checked at most once per few mistakes.
  if (mistakes.length < MISTAKES_PER_CHECK || mistakes.length % MISTAKES_PER_CHECK !== 0) {
    return;
  }

  const goal = await findLearnerLanguageGoal({ targetLanguage: language, userId });
  const snapshots = mistakes.map((mistake) => readMistakeSnapshot(mistake.snapshot));

  const { data, provenance } = await findMistakePattern({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goal?.id },
    learnerLanguage: goal?.language ?? "en",
    mistakes: snapshots.map((snapshot) => ({
      answer: snapshot.answer ?? "",
      correctAnswer: snapshot.correctAnswer ?? "",
      format: snapshot.format ?? "",
      question: snapshot.question,
    })),
    targetLanguage: language,
  });

  if (data.kind === "none") {
    return;
  }

  const shown = data.mistakeNumbers.flatMap((number) => {
    const snapshot = snapshots[number - 1];
    const mistake = mistakes[number - 1];
    return snapshot && mistake ? [{ id: mistake.id, snapshot }] : [];
  });

  await prisma.mistakePattern.create({
    data: {
      content: {
        contrast: data.contrast,
        drill: data.drill,
        examples: shown.map(({ snapshot }) => ({
          answer: snapshot.answer ?? "",
          correctAnswer: snapshot.correctAnswer ?? "",
          format: snapshot.format ?? "",
        })),
        rule: data.rule,
      },
      goalId: goal?.id ?? null,
      kind: data.kind,
      language,
      mistakeIds: shown.map(({ id }) => id),
      title: data.title,
      userId,
      ...toProvenanceData(provenance),
    },
  });

  // Today shows the new pattern.
  revalidateCacheTags([getUserProgressCacheTag(userId)]);

  await trackLearnerEvents({
    events: [
      {
        name: "Mistake Pattern Found",
        properties: { pattern_kind: data.kind, target_language: language },
      },
    ],
    goalId: goal?.id,
    userId,
  });
}

/**
 * After a wrong answer in a language lesson, looks for a pattern in the learner's recent mistakes
 * ("since" where English needs "for") once there are a few new ones, after the response. It may
 * also find they were only typos, which the card says kindly. Nothing is shown when there's none.
 */
export function scheduleMistakePatternCheck({
  language,
  userId,
}: {
  language: string;
  userId: string;
}): void {
  after(async () => {
    try {
      await checkForPattern({ language, userId });
    } catch (error) {
      logError("Mistake pattern check failed", error);
    }
  });
}
