import { prisma } from "@zoonk/db";

const byCreation = [{ createdAt: "asc" as const }, { id: "asc" as const }];

/** Model bookkeeping is not part of the learner's personal export. */
const MODEL_FIELDS = { model: true, promptVersion: true, runId: true } as const;

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

export async function loadBuddyExport(userId: string) {
  const [conversations, exampleLines] = await Promise.all([
    loadBuddyConversations(userId),
    prisma.stepExampleLine.findMany({ omit: MODEL_FIELDS, orderBy: byCreation, where: { userId } }),
  ]);

  return { conversations, exampleLines };
}

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

/** Excludes private source file addresses. */
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

/** Excludes Zoonk's internal costs. */
export function loadUsageExport(userId: string) {
  return prisma.usageRecord.findMany({
    omit: { costMicros: true },
    orderBy: byCreation,
    where: { userId },
  });
}
