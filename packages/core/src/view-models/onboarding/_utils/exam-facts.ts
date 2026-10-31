import "server-only";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { type GoalUnderstanding, type UnderstoodGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { prisma } from "@zoonk/db";
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

type NamedExam = {
  examName: string;
  /** The month the learner named with the year (1 to 12), such as 3 in "in March". */
  examMonth?: number | null;
  examYear?: number | null;
  institution?: string | null;
  /** The position for a public-service exam, in the learner's words. */
  role?: string | null;
  /** What the learner typed, which may name the edition they mean ("in March"). */
  words?: string | null;
};

export type ExamLookup = {
  exam: NamedExam;
  language: string;
  /** False when the learner gave their own day or books the test: then only the stored notice is read. */
  lookUpDate: boolean;
  noticeLanguages: string[];
  today: string;
};

export type StoredExam = { blueprintId: string; dates: OnboardingExamDate[] };

export type FoundExam = {
  lookup: ExamLookup;
  searched: OnboardingExamDate[];
  stored: StoredExam | null;
};

/** The learner waits for the card while this runs: past it, the date reads as not known yet. */
const SEARCH_TIMEOUT_MS = 30_000;

export function isNamedExam(goal: UnderstoodGoal): goal is UnderstoodGoal & { examName: string } {
  return goal.kind === "exam" && Boolean(goal.examName);
}

function toExamLookup({
  goal,
  language,
  today,
  words,
}: {
  goal: UnderstoodGoal & { examName: string };
  language: string;
  today: string;
  words: string;
}): ExamLookup {
  const tested = goal.targetLanguage;

  return {
    exam: {
      examMonth: goal.examMonth,
      examName: goal.examName,
      examYear: goal.examYear,
      institution: goal.institution,
      role: goal.targetPosition,
      words,
    },
    language,
    lookUpDate: !goal.targetDate && goal.examDay !== "booked",
    // Research may store a certificate's notice in the language it tests.
    noticeLanguages: tested && tested !== language ? [language, tested] : [language],
    today,
  };
}

export function listExamLookups({
  language,
  today,
  understanding,
  words,
}: {
  language: string;
  today: string;
  understanding: GoalUnderstanding;
  words: string;
}): (ExamLookup | null)[] {
  if (understanding.route !== "goals") {
    return [];
  }

  return understanding.goals.map((goal) =>
    isNamedExam(goal) ? toExamLookup({ goal, language, today, words }) : null,
  );
}

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

/** One identity decision in one language; throws when it fails. */
export async function findStoredExam({
  language,
  lookup,
}: {
  language: string;
  lookup: ExamLookup;
}): Promise<StoredExam | null> {
  const { exam, today } = lookup;

  const blueprint = await findSameExam({
    request: {
      board: null,
      country: null,
      language,
      name: exam.examName,
      ownerId: null,
      role: exam.role ?? null,
    },
    searchTerms: [exam.institution, exam.role].filter((term) => typeof term === "string"),
  });

  if (!blueprint) {
    return null;
  }

  const dates = await findStoredDates({
    edition: blueprint.edition,
    examMonth: exam.examMonth ?? null,
    examYear: exam.examYear ?? null,
    today,
  });

  return { blueprintId: blueprint.id, dates };
}

/** Searches the web only when no stored official day answers it; throws when the search fails. */
export async function searchExamDates({
  lookup,
  stored,
  userId,
}: {
  lookup: ExamLookup;
  stored: StoredExam | null;
  userId: string;
}): Promise<OnboardingExamDate[]> {
  const { exam, language, today } = lookup;

  if (!lookup.lookUpDate || stored?.dates.some((day) => !day.estimated)) {
    return [];
  }

  const search = await settleWithin({
    ms: SEARCH_TIMEOUT_MS,
    request: () =>
      findExamDate({
        analytics: { contentScope: "personal", distinctId: userId },
        exam: exam.examName,
        institution: exam.institution ?? null,
        language,
        role: exam.role ?? null,
        today,
        words: exam.words ?? null,
        year: exam.examYear ?? null,
      }),
  });

  if (search.status !== "settled" || search.value.data.status !== "official") {
    return [];
  }

  const { dates, source } = search.value.data;
  return dates.map((day) => ({ ...day, estimated: false, registrationClosed: false, source }));
}

export function toExamFacts({ lookup, searched, stored }: FoundExam): ExamFacts {
  const blueprintId = stored?.blueprintId ?? null;
  const [first] = searched;

  if (!first) {
    return { blueprintId, dates: stored?.dates ?? [], targetDate: null };
  }

  // A conflicting month may be another sitting; preserve the month the learner chose.
  const keptMonth = getKeptMonthStart({
    details: { examMonth: lookup.exam.examMonth, examYear: lookup.exam.examYear },
    noticeDay: first.date,
    today: lookup.today,
  });

  return { blueprintId, dates: searched, targetDate: keptMonth ? null : first.date };
}
