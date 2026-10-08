import { prisma } from "@zoonk/db";

const byCreation = [{ createdAt: "asc" as const }, { id: "asc" as const }];

/** Which model and run wrote a row: our bookkeeping, not something about the learner. */
const MODEL_FIELDS = { model: true, promptVersion: true, runId: true } as const;

/**
 * The learner's conversations with their buddy, one per lesson, chapter, goal or mock they asked
 * about, each question with its answer and any plan change or app feature the answer offered.
 */
function loadBuddyConversations(userId: string) {
  return prisma.lessonQuestionThread.findMany({
    include: {
      questions: {
        omit: {
          ...MODEL_FIELDS,
          finishReason: true,
          generationRevision: true,
          provider: true,
          requestFingerprint: true,
          requestId: true,
          requestedModel: true,
        },
        orderBy: byCreation,
      },
    },
    orderBy: byCreation,
    where: { userId },
  });
}

/** The buddy's talks and the example lines lessons wrote for the learner from their memory. */
export async function loadBuddyExport(userId: string) {
  const [conversations, exampleLines] = await Promise.all([
    loadBuddyConversations(userId),
    prisma.stepExampleLine.findMany({ omit: MODEL_FIELDS, orderBy: byCreation, where: { userId } }),
  ]);

  return { conversations, exampleLines };
}

/** Study sessions with their blocks, mock exams with their answers, and reported exam results. */
export async function loadStudyExport(userId: string) {
  const [sessions, mockExams, examResults] = await Promise.all([
    prisma.studySession.findMany({
      include: { blocks: { orderBy: { position: "asc" } } },
      orderBy: byCreation,
      where: { userId },
    }),
    prisma.mockExam.findMany({
      include: { answers: { orderBy: byCreation } },
      orderBy: byCreation,
      where: { userId },
    }),
    prisma.examResult.findMany({ orderBy: byCreation, where: { userId } }),
  ]);

  return { examResults, mockExams, sessions };
}

/** Language learning: levels per skill, words, pronunciation reviews, calls and mistake patterns. */
export async function loadLanguageExport(userId: string) {
  const [levels, words, pronunciationReviews, calls, mistakePatterns] = await Promise.all([
    prisma.languageSkillLevel.findMany({ orderBy: byCreation, where: { userId } }),
    prisma.learnerWord.findMany({
      orderBy: [{ learnedAt: "asc" }, { id: "asc" }],
      where: { userId },
    }),
    prisma.pronunciationReview.findMany({ orderBy: byCreation, where: { userId } }),
    prisma.languageConversation.findMany({
      omit: { ...MODEL_FIELDS, liveModel: true },
      orderBy: byCreation,
      where: { userId },
    }),
    prisma.mistakePattern.findMany({ omit: MODEL_FIELDS, orderBy: byCreation, where: { userId } }),
  ]);

  return { calls, levels, mistakePatterns, pronunciationReviews, words };
}

/**
 * How the learner started and what they brought: goals they typed before a plan, goals suggested
 * from earlier courses, the sources they added (without the private file address) and the
 * instruments they're waiting for.
 */
export async function loadStartExport(userId: string) {
  const [drafts, suggestedGoals, sources, instrumentWaitlist] = await Promise.all([
    prisma.onboardingDraft.findMany({
      omit: { runId: true },
      orderBy: byCreation,
      where: { userId },
    }),
    prisma.suggestedGoal.findMany({ orderBy: byCreation, where: { userId } }),
    prisma.learnerSource.findMany({
      include: {
        source: { select: { kind: true, mimeType: true, publisher: true, title: true, url: true } },
      },
      orderBy: byCreation,
      where: { userId },
    }),
    prisma.instrumentWaitlistEntry.findMany({ orderBy: byCreation, where: { userId } }),
  ]);

  return { drafts, instrumentWaitlist, sources, suggestedGoals };
}

/** What the learner used of their allowances, without what it cost Zoonk. */
export function loadUsageExport(userId: string) {
  return prisma.usageRecord.findMany({
    omit: { costMicros: true },
    orderBy: byCreation,
    where: { userId },
  });
}
