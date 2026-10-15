import { type SelectedSummary } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices } from "./chosen-bases";
import { estimateDailyNeed, readFixedDays } from "./daily-need";
import { type ExamSubjectShare } from "./feasibility-coverage";
import { getBaseChoices } from "./plan-bases";
import { daysBetween, toIsoDate } from "./plan-calendar";
import { getCoverage } from "./selected-coverage";
import { listSettled, readRequirement, sumRequirement } from "./selected-requirement";

/** A goal this close (in days) studies its bases with a quick lesson by default (see `getDefaultBaseChoice`). */
const CLOSE_TO_DATE_DAYS = 60;

/**
 * The last day new lessons count by: an exam's final stretch start as this build laid it out, else
 * the target date; days before it count, the day itself doesn't. Null without a date.
 */
function getDeadline({ built, input }: { built: BuiltPlan; input: BuildPlanInput }) {
  const { targetDate } = input.goal;

  if (!targetDate) {
    return null;
  }

  const finalStretch = built.phases.find((phase) => phase.kind === "finalStretch");
  return finalStretch?.startDate ?? toIsoDate(targetDate);
}

/**
 * How a goal studies its bases unless the learner chose otherwise: each for its core, or with a
 * quick lesson when its date is close, by the date alone. Never every lesson by default.
 */
function getDefaultBaseChoice(daysLeft: number | null): "essential" | "quick" {
  return daysLeft !== null && daysLeft <= CLOSE_TO_DATE_DAYS ? "quick" : "essential";
}

/** The plan's bases with the choice this build studied each with (see `SelectedSummary.bases`). */
function summarizeBases(input: BuildPlanInput): SelectedSummary["bases"] {
  const bases = input.bases ?? [];

  if (bases.length === 0) {
    return null;
  }

  const choices = getBaseChoices({ bases, choices: getKeptBaseChoices(input) });
  const daysLeft = input.goal.targetDate ? daysBetween(input.today, input.goal.targetDate) : null;

  return {
    bases: bases.map((base) => ({
      choice: choices.get(base.skillId) ?? "essential",
      known: base.known,
      minutes: {
        deep: base.minutes.deep,
        essential: base.minutes.essential,
        quick: input.quickLessons?.has(base.skillId) ? base.minutes.quick : null,
      },
      skillId: base.skillId,
    })),
    daysLeft,
    defaultChoice: getDefaultBaseChoice(daysLeft),
  };
}

/** When the selected schedule's work still to do ends: its last teaching's time, or its last challenge. */
function getEndDate(built: BuiltPlan): string | null {
  return built.items.reduce<string | null>((latest, item) => {
    const counts =
      item.status === "todo" &&
      item.scheduledFor !== null &&
      (item.kind === "lesson" || item.kind === "chapter" || item.kind === "boss");

    if (!counts || !item.scheduledFor) {
      return latest;
    }

    const end = toIsoDate(built.teachingEnds.get(item.key) ?? item.scheduledFor);
    return !latest || end > latest ? end : latest;
  }, null);
}

/**
 * Every skill the build read, before any cut or choice: the graph's and what they build on, each
 * lesson's (the quick ones too), the saved items', the bosses' projection, recordings and merged
 * skills' survivors, and the bases'. A change to the content of any of them changes the plan.
 */
function listSourceSkillIds({
  built,
  input,
}: {
  built: BuiltPlan;
  input: BuildPlanInput;
}): string[] {
  const facts = input.bossFacts;

  const ids = [
    ...input.graph.skills.map((skill) => skill.skillId),
    ...[...input.prerequisites].flatMap(([skillId, required]) => [skillId, ...required]),
    ...input.lessons.flatMap((lesson) => lesson.skillIds),
    ...[...(input.quickLessons ?? [])].flatMap(([skillId, lesson]) => [
      skillId,
      ...lesson.skillIds,
    ]),
    ...input.items.flatMap((item) => (item.skillId ? [item.skillId] : [])),
    ...built.items.flatMap((item) => (item.skillId ? [item.skillId] : [])),
    ...(input.bases ?? []).map((base) => base.skillId),
    ...(facts?.rows.lessonSkills.map((row) => row.skillId) ?? []),
    ...(facts?.rows.chapterLessons.flatMap((row) =>
      row.lesson.skills.map((skill) => skill.skillId),
    ) ?? []),
    ...[...(facts?.survivors ?? [])].flatMap(([merged, survivor]) => [merged, survivor]),
    ...(facts?.bank.recordingSets.flatMap((set) => set.skillIds) ?? []),
    ...(facts?.listeningSkillIds ?? []),
  ];

  return [...new Set(ids)].toSorted();
}

/**
 * The facts a saved plan keeps of its one selected build (see `SelectedSummary`): what it covers
 * of the chosen requirement by the deadline, about how much daily time that requirement needs,
 * the requirement's size, the bases' choices, when the schedule ends and what it read. Reads only
 * this build and its input: no other plan is built.
 */
export function summarizeSelectedPlan({
  built,
  examSubjects,
  input,
}: {
  built: BuiltPlan;
  /** The notice subjects with their exam share; null for goals that aren't exams. */
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
}): SelectedSummary {
  const deadline = getDeadline({ built, input });
  const requirementBySkill = readRequirement(input);
  const settled = listSettled(input);
  const requirement = sumRequirement({ built, requirement: requirementBySkill, settled });

  return {
    bases: summarizeBases(input),
    coverage: deadline
      ? getCoverage({
          built,
          deadline,
          examSubjects,
          input,
          requirement: requirementBySkill,
          settled,
        })
      : null,
    dailyNeed: deadline
      ? estimateDailyNeed({
          fixed: readFixedDays({ built, deadline, input }),
          remaining: requirement.remainingRaw,
        })
      : { basis: "estimated", minutes: null, reason: "noDeadline" },
    endDate: getEndDate(built),
    requirement,
    sourceSkillIds: listSourceSkillIds({ built, input }),
    totalMinutes: built.estimate.totalMinutes,
  };
}
