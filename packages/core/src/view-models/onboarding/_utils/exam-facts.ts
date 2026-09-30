import "server-only";
import { prisma } from "@zoonk/db";
import { getExamEditionDays } from "../../../exams/_utils/exam-edition-days";
import { type ExamDate, examEditionSchema } from "../../../library/exams/blueprint-contract";
import { buildExamIdentityKey } from "../../../library/exams/exam-identity";
import { type OnboardingExamDate } from "../onboarding-contract";

export type ExamFacts = { blueprintId: string | null; dates: OnboardingExamDate[] };

const NO_FACTS: ExamFacts = { blueprintId: null, dates: [] };

/** The learner's own language first, then any other edition of the same exam. */
function pickBlueprint<T extends { language: string }>({
  blueprints,
  language,
}: {
  blueprints: T[];
  language: string;
}): T | null {
  return blueprints.find((blueprint) => blueprint.language === language) ?? blueprints[0] ?? null;
}

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
 * What the stored notice says about an exam the learner named: its blueprint and the exam days
 * still ahead. The edition is the year the learner named, or the notice's own while its days are
 * ahead. Official days come with the source they were read from; a year the notice isn't for
 * (ENEM 2028 while the stored notice is 2026's), or the next edition once every day has passed,
 * gets the days it most likely has from the notice's timing, marked as estimated. An exam research
 * hasn't read yet has no dates, and research starts once the goal exists.
 */
export async function findExamFacts({
  examName,
  examYear = null,
  language,
  today,
}: {
  examName: string;
  /** The year the learner named, such as 2028 in "Enem 2028". */
  examYear?: number | null;
  language: string;
  today: string;
}): Promise<ExamFacts> {
  const blueprints = await prisma.examBlueprint.findMany({
    select: { edition: true, id: true, language: true },
    where: { identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }) },
  });

  const blueprint = pickBlueprint({ blueprints, language });

  if (!blueprint) {
    return NO_FACTS;
  }

  const { days, estimated } = getExamEditionDays({
    edition: examEditionSchema.safeParse(blueprint.edition).data ?? null,
    examYear,
    from: today,
  });

  const ahead = days.filter((day) => day.date >= today);

  const dates = estimated
    ? ahead.map((day) => ({ date: day.date, estimated: true, label: day.label, source: null }))
    : await withSources(ahead);

  return { blueprintId: blueprint.id, dates };
}
