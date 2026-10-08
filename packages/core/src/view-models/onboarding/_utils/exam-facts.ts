import "server-only";
import { type FindExamDateParams, findExamDate } from "@zoonk/ai/tasks/v2/goals/find-exam-date";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { settleWithin } from "@zoonk/utils/timeout";
import { getExamEditionDays } from "../../../exams/_utils/exam-edition-days";
import { type ExamDate, examEditionSchema } from "../../../library/exams/blueprint-contract";
import { findSameExam } from "../../../library/exams/exam-identity";
import { type OnboardingExamDate } from "../onboarding-contract";

/**
 * What the world knows about an exam the learner named: its stored blueprint, its days still
 * ahead, and the day to plan for when only a quick lookup found it (no stored notice gives it).
 */
export type ExamFacts = {
  blueprintId: string | null;
  dates: OnboardingExamDate[];
  /** The official first day a lookup found, so the plan has its date before research runs. */
  targetDate: string | null;
};

/** The exam as the learner's words named it. */
export type NamedExam = {
  examName: string;
  /** The month the learner named with the year (1 to 12), such as 3 in "in March". */
  examMonth?: number | null;
  /** The year the learner named, such as 2028 in "Enem 2028". */
  examYear?: number | null;
  institution?: string | null;
  /** The position for a public-service exam, in the learner's words. */
  role?: string | null;
  /** What the learner typed, which may name the edition they mean ("in March"). */
  words?: string | null;
};

type AiGenerationContext = FindExamDateParams["analytics"];

/** The learner reads the card while this runs: past it, the date reads as not known yet. */
const LOOKUP_TIMEOUT_MS = 30_000;

/** Each day with the public page it was read from, so the learner can check it. */
async function withSources(days: ExamDate[]): Promise<OnboardingExamDate[]> {
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
      source: source?.url ? { title: source.title, url: source.url } : null,
    };
  });
}

/**
 * The stored notice's days for the edition the learner means: the year they named, or the
 * notice's own while its days are ahead. A year the notice isn't for (ENEM 2028 while the stored
 * notice is 2026's), or the next edition once every day has passed, gets the days it most likely
 * has from the notice's timing, marked as estimated, in the month the learner named when they did.
 */
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
    ? ahead.map((day) => ({ date: day.date, estimated: true, label: day.label, source: null }))
    : withSources(ahead);
}

/**
 * The exam's official days from a quick search, with the page they came from; none when the
 * notice isn't out, the search can't tell, or it takes too long. Research still reads the whole
 * notice once the goal exists.
 */
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
  // A search that fails leaves the date to be confirmed, like one that finds nothing: the card
  // never waits on it, and research reads the notice later anyway.
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
  return dates.map((day) => ({ ...day, estimated: false, source }));
}

/**
 * What an exam the learner named has for their card: its stored blueprint (the same exam under
 * another name or a role written another way counts) and its days still ahead, official with
 * their source or estimated from its usual timing. When no stored notice gives an official day, a
 * quick search looks for the published one; the day it finds becomes the goal's date, with its
 * source. An exam nobody has published a day for yet has no dates: the card says it's to be
 * confirmed, and research fills it in once the goal exists.
 */
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
  /**
   * Asked right before the web search for the exam's day, which costs: false skips it (a reused
   * understanding past the learner's small AI calls). Unset, the search always runs.
   */
  allowSearch?: () => Promise<boolean>;
  today: string;
}): Promise<ExamFacts> {
  // A match the evaluation model couldn't confirm reads as no stored notice: the card still shows,
  // and research finds the notice once the goal exists.
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
      // The role ranks the right one of a notice's many roles among the candidates.
      searchTerms: [exam.institution, exam.role].filter((term) => typeof term === "string"),
    }),
  );

  if (error) {
    logError("The stored exam match failed:", error);
  }

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

  return first
    ? { blueprintId, dates: found, targetDate: first.date }
    : { blueprintId, dates: stored, targetDate: null };
}
