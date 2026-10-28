import "server-only";
import { type FindExamDateParams, findExamDate } from "@zoonk/ai/tasks/v2/goals/find-exam-date";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { settleWithin } from "@zoonk/utils/timeout";
import { type EditionExamDay, getExamEditionDays } from "../../../exams/_utils/exam-edition-days";
import { getKeptMonthStart } from "../../../exams/kept-month";
import { examEditionSchema } from "../../../library/exams/blueprint-contract";
import { findSameExam } from "../../../library/exams/find-same-exam";
import { type OnboardingExamDate } from "../onboarding-contract";

export type ExamFacts = {
  blueprintId: string | null;
  dates: OnboardingExamDate[];
  /** The official first day a lookup found, so the plan has its date before research runs. */
  targetDate: string | null;
};

export type NamedExam = {
  examName: string;
  /** The month the learner named with the year (1 to 12), such as 3 in "in March". */
  examMonth?: number | null;
  examYear?: number | null;
  institution?: string | null;
  /** The position for a public-service exam, in the learner's words. */
  role?: string | null;
  /** Certificate language, which may also be the stored notice language; null for other exams. */
  targetLanguage?: string | null;
  /** What the learner typed, which may name the edition they mean ("in March"). */
  words?: string | null;
};

type AiGenerationContext = FindExamDateParams["analytics"];

/** The learner reads the card while this runs: past it, the date reads as not known yet. */
const LOOKUP_TIMEOUT_MS = 30_000;

async function withSources(days: EditionExamDay[]): Promise<OnboardingExamDate[]> {
  const sources = await prisma.source.findMany({
    select: { id: true, title: true, url: true },
    where: { id: { in: days.map((day) => day.citation.sourceId) }, visibility: "public" },
  });

  return days.map((day) => {
    const source = sources.find((item) => item.id === day.citation.sourceId);

    return {
      date: day.date,
      estimated: false,
      label: day.label,
      registrationClosed: day.registrationClosed,
      source: source?.url ? { title: source.title, url: source.url } : null,
    };
  });
}

/** Reuses official dates only for the matching edition; otherwise estimates timing within the learner's requested month. */
async function findStoredDates({
  edition,
  examMonth,
  examYear,
  today,
}: {
  edition: unknown;
  examMonth: number | null;
  examYear: number | null;
  today: string;
}): Promise<OnboardingExamDate[]> {
  const { days, estimated } = getExamEditionDays({
    edition: examEditionSchema.safeParse(edition).data ?? null,
    examMonth,
    examYear,
    from: today,
  });

  const ahead = days.filter((day) => day.date >= today);

  return estimated
    ? ahead.map((day) => ({
        date: day.date,
        estimated: true,
        label: day.label,
        registrationClosed: false,
        source: null,
      }))
    : withSources(ahead);
}

/** Returns no dates on failure or timeout; full notice research still runs after goal creation. */
async function lookUpExamDays({
  analytics,
  exam,
  language,
  today,
}: {
  analytics?: AiGenerationContext;
  exam: NamedExam;
  language: string;
  today: string;
}): Promise<OnboardingExamDate[]> {
  const { data: lookup, error } = await safeAsync(() =>
    settleWithin({
      ms: LOOKUP_TIMEOUT_MS,
      request: () =>
        findExamDate({
          analytics,
          exam: exam.examName,
          institution: exam.institution ?? null,
          language,
          role: exam.role ?? null,
          today,
          words: exam.words ?? null,
          year: exam.examYear ?? null,
        }),
    }),
  );

  if (error) {
    logError("The exam date lookup failed:", error);
  }

  if (lookup?.status !== "settled" || lookup.value.data.status !== "official") {
    return [];
  }

  const { dates, source } = lookup.value.data;
  return dates.map((day) => ({ ...day, estimated: false, registrationClosed: false, source }));
}

async function findStoredExamIn({ exam, language }: { exam: NamedExam; language: string }) {
  const { data: blueprint, error } = await safeAsync(() =>
    findSameExam({
      request: {
        board: null,
        country: null,
        language,
        name: exam.examName,
        ownerId: null,
        role: exam.role ?? null,
      },
      searchTerms: [exam.institution, exam.role].filter((term) => typeof term === "string"),
    }),
  );

  if (error) {
    logError("The stored exam match failed:", error);
  }

  return blueprint ?? null;
}

/** Search learner language first, then certificate language because research may store the notice there. */
async function findStoredExam({ exam, language }: { exam: NamedExam; language: string }) {
  const own = await findStoredExamIn({ exam, language });
  const tested = exam.targetLanguage;

  if (own || !tested || tested === language) {
    return own;
  }

  return findStoredExamIn({ exam, language: tested });
}

/** May search when no stored official date exists; a conflicting discovered month is offered without replacing the learner's month. */
export async function findExamFacts({
  analytics,
  exam,
  language,
  allowSearch,
  lookUpDate = true,
  today,
}: {
  analytics?: AiGenerationContext;
  exam: NamedExam;
  language: string;
  /** False when the learner gave their own day: then only the stored notice is read. */
  lookUpDate?: boolean;
  /** Called before paid search; false skips it, while omission permits it. */
  allowSearch?: () => Promise<boolean>;
  today: string;
}): Promise<ExamFacts> {
  const blueprint = await findStoredExam({ exam, language });

  const stored = blueprint
    ? await findStoredDates({
        edition: blueprint.edition,
        examMonth: exam.examMonth ?? null,
        examYear: exam.examYear ?? null,
        today,
      })
    : [];

  const blueprintId = blueprint?.id ?? null;

  if (!lookUpDate || stored.some((day) => !day.estimated)) {
    return { blueprintId, dates: stored, targetDate: null };
  }

  if (allowSearch && !(await allowSearch())) {
    return { blueprintId, dates: stored, targetDate: null };
  }

  const found = await lookUpExamDays({ analytics, exam, language, today });
  const [first] = found;

  if (!first) {
    return { blueprintId, dates: stored, targetDate: null };
  }

  // A conflicting month may be another sitting; preserve the month the learner chose.
  const keptMonth = getKeptMonthStart({
    details: { examMonth: exam.examMonth, examYear: exam.examYear },
    noticeDay: first.date,
    today,
  });

  return { blueprintId, dates: found, targetDate: keptMonth ? null : first.date };
}
