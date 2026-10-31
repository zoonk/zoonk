import "server-only";
import { findMistakePattern } from "@zoonk/ai/tasks/language/mistake-pattern";
import { type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { readMistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { findLearnerLanguageGoal } from "../_utils/language-goal";

const MAX_MISTAKES = 20;
const MISTAKES_PER_CHECK = 3;
const RECENT_DAYS = 14;

type LearnerLanguage = { language: string; userId: string };

async function newMistakesWhere({
  db = prisma,
  language,
  userId,
}: LearnerLanguage & { db?: TransactionClient }) {
  const latest = await db.mistakePattern.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: { language, userId },
  });

  const since = new Date(
    Math.max(Date.now() - RECENT_DAYS * MS_PER_DAY, latest?.createdAt.getTime() ?? 0),
  );

  return { createdAt: { gt: since }, step: { lesson: { targetLanguage: language } }, userId };
}

/** Every third new mistake owes a look for a pattern, decided by the answer that makes it. */
export async function isPatternCheckDue(
  input: LearnerLanguage & { db: TransactionClient },
): Promise<boolean> {
  const count = await input.db.mistake.count({ where: await newMistakesWhere(input) });
  return count >= MISTAKES_PER_CHECK && count % MISTAKES_PER_CHECK === 0;
}

async function loadNewMistakes(input: LearnerLanguage) {
  const where = await newMistakesWhere(input);

  const [count, mistakes] = await Promise.all([
    prisma.mistake.count({ where }),
    prisma.mistake.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, snapshot: true },
      take: MAX_MISTAKES,
      where,
    }),
  ]);

  return { count, mistakes };
}

/**
 * Internal, for the follow-up the third new mistake owes. It reads the mistakes as of when it runs,
 * so asks that arrive before it run are one check. A model failure throws.
 */
export async function checkMistakePattern({ language, userId }: LearnerLanguage): Promise<void> {
  const { count, mistakes } = await loadNewMistakes({ language, userId });

  if (count < MISTAKES_PER_CHECK) {
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

  const pattern = {
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
  };

  await writeLearnerChange({ userId }, (tx) => tx.mistakePattern.create({ data: pattern }));

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
