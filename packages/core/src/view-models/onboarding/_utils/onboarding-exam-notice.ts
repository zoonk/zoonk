import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getNoSitting } from "../../../exams/_utils/notice-day";
import { getExamCalendarDay, getPlanExamDays } from "../../../exams/_utils/plan-exam-days";
import { listExamChoiceViews } from "../../../exams/choices/exam-choice-views";
import { toChosenStructure } from "../../../exams/choices/exam-choices";
import { loadExamPicks } from "../../../exams/choices/load-exam-choices";
import { findNamedChoices } from "../../../exams/choices/named-exam-choices";
import { isWrittenSubject } from "../../../exams/mocks/written-subject";
import { examStructureSchema } from "../../../library/exams/blueprint-contract";
import { type NoSitting } from "../../../plans/plan-view-contract";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { type OnboardingView } from "../onboarding-contract";

/** Before a POST saves it, an option the learner's stated position or answers name already counts as picked, so only a choice nothing names is asked. */
export async function findExamNotice({
  details,
  goal,
  goalDate,
  today,
}: {
  details: Record<string, unknown>;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id">;
  goalDate: string | null;
  today: string;
}): Promise<{
  choices: OnboardingView["examChoices"];
  examDate: string | null;
  examDays: OnboardingView["examDays"];
  fromMaterial: boolean;
  hasUnpickedChoice: boolean;
  noSitting: NoSitting | null;
  subjects: OnboardingView["examSubjects"];
}> {
  if (!goal.examBlueprintId) {
    return {
      choices: [],
      examDate: null,
      examDays: null,
      fromMaterial: false,
      hasUnpickedChoice: false,
      noSitting: null,
      subjects: [],
    };
  }

  const [blueprint, saved] = await Promise.all([
    prisma.examBlueprint.findUnique({
      select: { edition: true, examDate: true, ownerId: true, structure: true },
      where: { id: goal.examBlueprintId },
    }),
    loadExamPicks(goal.id),
  ]);

  const stored = examStructureSchema.safeParse(blueprint?.structure).data;

  const picks = stored
    ? {
        ...saved,
        examChoices: [
          ...saved.examChoices,
          ...findNamedChoices({ goal, picks: saved, structure: stored }),
        ],
      }
    : saved;

  const structure = stored && toChosenStructure({ picks, structure: stored });

  // Written papers are not subjects the learner can declare already known.
  const subjects = structure
    ? structure.subjects.filter((subject) => !isWrittenSubject({ structure, subject }))
    : [];

  const views = stored ? listExamChoiceViews({ picks, structure: stored }) : [];

  return {
    choices: views,
    examDate: blueprint?.examDate ? toIsoDate(blueprint.examDate) : null,
    examDays:
      blueprint && !blueprint.ownerId
        ? getNextSittingDays({ edition: blueprint.edition, today })
        : null,
    fromMaterial: Boolean(blueprint?.ownerId),
    hasUnpickedChoice: views.some((choice) => choice.subjects.length === 0),
    noSitting: getNoSitting({ blueprint, details, goalDate, today }),
    subjects: subjects.map((subject) => ({
      name: subject.name,
      shortName: subject.shortName ?? null,
    })),
  };
}

/** After both the exam's day and the learner's, so the sitting offered can still be planned for. */
function getNextSittingDays({
  edition,
  today,
}: {
  edition: unknown;
  today: string;
}): OnboardingView["examDays"] {
  const examDay = getExamCalendarDay({ edition, now: new Date() }).today;
  const from = examDay > today ? examDay : today;
  const found = getPlanExamDays({ details: {}, edition, goalDate: null, today: from });

  return found.days.length > 0
    ? { days: found.days.map((day) => day.date), estimated: found.estimated }
    : null;
}
