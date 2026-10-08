import "server-only";
import { readExamMonth } from "../../../exams/_utils/exam-edition-days";
import { loadTargetCutoff } from "../../../exams/cutoffs/load-target-cutoff";
import { type GoalDraft } from "../../../goals/goal-contract";
import {
  type GoalUnderstandingView,
  type OnboardingDraftEdit,
  type UnderstoodGoalView,
} from "../onboarding-contract";
import { allowDateSearch } from "./date-search";
import { findExamFacts } from "./exam-facts";

type GoalsUnderstanding = Extract<GoalUnderstandingView, { status: "goals" }>;
type GoalEdit = Exclude<OnboardingDraftEdit, { field: "studyTime" }>;
type Details = NonNullable<GoalDraft["details"]>;

function withoutKey<Value extends object, Key extends keyof Value>(
  value: Value,
  key: Key,
): Omit<Value, Key> {
  const { [key]: _removed, ...rest } = value;
  return rest;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readYear(isoDate: string): number {
  return new Date(isoDate).getUTCFullYear();
}

function setDetail({
  details,
  key,
  value,
}: {
  details: Details;
  key: string;
  value: string | null;
}) {
  return value === null ? withoutKey(details, key) : { ...details, [key]: value };
}

/** The learner's own deadline replaces the exam's dates on the card; null brings them back. */
function reviseTargetDate({
  goal,
  today,
  value,
}: {
  goal: UnderstoodGoalView;
  today: string;
  value: string | null;
}): UnderstoodGoalView | null {
  if (value !== null && value < today) {
    return null;
  }

  const draft = withoutKey(goal.draft, "targetDate");
  return { ...goal, draft: value === null ? draft : { ...draft, targetDate: value } };
}

/**
 * A title that names the old year ("Pass ENEM 2027") names the new one: the year is part of what
 * the title says, not a separate fact.
 */
function retitleForYear({ from, title, to }: { from: unknown; title: string; to: number }): string {
  return typeof from === "number"
    ? title.replaceAll(new RegExp(`\\b${from}\\b`, "gu"), String(to))
    : title;
}

/**
 * Another year of the same exam: that year's dates (from its notice or a quick search for the
 * published one, or estimated from its usual timing) and blueprint, a title naming the old year
 * names the new one, and a deadline set for the old year no longer holds.
 */
async function reviseExamYear({
  goal,
  today,
  value,
}: {
  goal: UnderstoodGoalView;
  today: string;
  value: number;
}): Promise<UnderstoodGoalView | null> {
  const details = goal.draft.details ?? {};
  const { examName } = details;

  if (goal.draft.kind !== "exam" || typeof examName !== "string" || value < readYear(today)) {
    return null;
  }

  // The learner can type any year, so its day is searched for only as one of their small AI calls.
  const facts = await findExamFacts({
    allowSearch: allowDateSearch,
    exam: {
      examMonth: readExamMonth(details),
      examName,
      examYear: value,
      institution: readText(details.institution),
      role: readText(details.targetPosition),
      words: goal.draft.prompt,
    },
    language: goal.draft.language,
    today,
  });

  const draft = withoutKey(goal.draft, "targetDate");

  return {
    // Another year's exam may be another notice: `reviseUnderstanding` reads its cut-off again.
    cutoff: null,
    draft: {
      ...withoutKey(draft, "examBlueprintId"),
      ...(facts.blueprintId ? { examBlueprintId: facts.blueprintId } : {}),
      ...(facts.targetDate ? { targetDate: facts.targetDate } : {}),
      details: { ...details, examYear: value },
      title: retitleForYear({ from: details.examYear, title: draft.title, to: value }),
    },
    examDates: facts.dates,
  };
}

async function reviseGoal({
  edit,
  goal,
  today,
}: {
  edit: GoalEdit;
  goal: UnderstoodGoalView;
  today: string;
}): Promise<UnderstoodGoalView | null> {
  switch (edit.field) {
    case "title":
      return { ...goal, draft: { ...goal.draft, title: edit.value } };
    case "targetDate":
      return reviseTargetDate({ goal, today, value: edit.value });
    case "examYear":
      return reviseExamYear({ goal, today, value: edit.value });
    case "institution":
    case "reason":
    case "role":
    case "targetCourse":
    case "targetPosition":
    case "targetScore": {
      const details = setDetail({
        details: goal.draft.details ?? {},
        key: edit.field,
        value: edit.value,
      });

      return { ...goal, draft: { ...goal.draft, details } };
    }
    default:
      return null;
  }
}

/** A time of their own replaces when the words said they study, on every goal of the card. */
function reviseStudyTime({
  understanding,
  value,
}: {
  understanding: GoalsUnderstanding;
  value: string;
}): GoalsUnderstanding {
  return {
    ...understanding,
    goals: understanding.goals.map((goal) => ({
      ...goal,
      draft: { ...goal.draft, details: withoutKey(goal.draft.details ?? {}, "studyTimeNote") },
    })),
    schedule: { ...understanding.schedule, studyTime: value, studyTimeNote: null },
  };
}

/**
 * The card with one fix applied and every field that depends on it recomputed. Null when the fix
 * doesn't apply: no such goal, a year for a goal that isn't an exam, or a day or year already past.
 */
export async function reviseUnderstanding({
  edit,
  today,
  understanding,
}: {
  edit: OnboardingDraftEdit;
  /** The learner's own today, so past days and years are refused. */
  today: string;
  understanding: GoalsUnderstanding;
}): Promise<GoalsUnderstanding | null> {
  if (edit.field === "studyTime") {
    return reviseStudyTime({ understanding, value: edit.value });
  }

  const goal = understanding.goals[edit.goal];
  const revised = goal ? await reviseGoal({ edit, goal, today }) : null;

  if (!revised) {
    return null;
  }

  // Another course, institution, position or year has its own cut-off, when one is known.
  const cutoff = await loadTargetCutoff({
    details: revised.draft.details,
    examBlueprintId: revised.draft.examBlueprintId,
  });

  return { ...understanding, goals: understanding.goals.with(edit.goal, { ...revised, cutoff }) };
}
