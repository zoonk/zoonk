import { createHash } from "node:crypto";
import { type SelectedCoverage, type SelectedSummary } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices } from "./chosen-bases";
import { estimateDailyNeed, estimateFinish, readFixedDays } from "./daily-need";
import { mayCostToKeepPhaseDates } from "./phase-dates-move";
import { getBaseChoices, getDefaultBaseChoice } from "./plan-bases";
import { daysBetween, toIsoDate } from "./plan-calendar";
import { type ExamSubjectShare, getCoverage } from "./selected-coverage";
import { listSettled, readRequirement, sumRequirement } from "./selected-requirement";

function getDeadline({ built, input }: { built: BuiltPlan; input: BuildPlanInput }) {
  const { targetDate } = input.goal;

  if (!targetDate) {
    return null;
  }

  const finalStretch = built.phases.find((phase) => phase.kind === "finalStretch");
  return finalStretch?.startDate ?? toIsoDate(targetDate);
}

export function getSelectedCoverage({
  built,
  examSubjects,
  input,
}: {
  built: BuiltPlan;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
}): SelectedCoverage | null {
  const deadline = getDeadline({ built, input });
  const { targetDate } = input.goal;

  return deadline && targetDate
    ? getCoverage({
        built,
        deadline,
        examSubjects,
        input,
        requirement: readRequirement({ built, input }),
        settled: listSettled(input),
        targetDate: toIsoDate(targetDate),
      })
    : null;
}

function summarizeBases(input: BuildPlanInput): SelectedSummary["bases"] {
  const bases = input.bases ?? [];

  if (bases.length === 0) {
    return null;
  }

  const choices = getBaseChoices({ bases, choices: getKeptBaseChoices(input) });
  const daysLeft = input.goal.targetDate ? daysBetween(input.today, input.goal.targetDate) : null;

  return {
    bases: bases.map((base) => ({
      area: base.area,
      choice: choices.get(base.skillId) ?? "essential",
      choices: base.choices,
      known: base.known,
      minutes: {
        deep: base.minutes.deep,
        essential: base.minutes.essential,
        quick: input.quickLessons?.has(base.skillId) ? base.minutes.quick : null,
      },
      name: base.name,
      neededFor: base.neededFor,
      skillId: base.skillId,
      studied: base.studied,
    })),
    daysLeft,
    defaultChoice: getDefaultBaseChoice(daysLeft),
  };
}

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

function readPhaseDates({
  built,
  input,
}: {
  built: BuiltPlan;
  input: BuildPlanInput;
}): SelectedSummary["phaseDates"] {
  const kept = input.phaseEnds !== undefined && input.phaseEnds.size > 0;

  if (!kept || !mayCostToKeepPhaseDates(built)) {
    return { structureKey: null, trigger: false };
  }

  const structure = {
    dropped: built.droppedSkillIds.toSorted(),
    endsBeforeLessons: built.endsBeforeLessons.toSorted((a, b) => a - b),
    strained: built.strainedEnds
      .map(({ phase, resting, room }) => ({ phase, resting, room }))
      .toSorted((a, b) => a.phase - b.phase),
  };

  return {
    structureKey: createHash("sha256").update(JSON.stringify(structure)).digest("hex"),
    trigger: true,
  };
}

export function summarizeSelectedPlan({
  built,
  examSubjects,
  input,
}: {
  built: BuiltPlan;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
}): SelectedSummary {
  const deadline = getDeadline({ built, input });
  const requirementBySkill = readRequirement({ built, input });
  const settled = listSettled(input);
  const requirement = sumRequirement({ built, requirement: requirementBySkill, settled });

  return {
    bases: summarizeBases(input),
    coverage: getSelectedCoverage({ built, examSubjects, input }),
    endDate: getEndDate(built),
    forecast: {
      basis: "estimated",
      dailyNeed: deadline
        ? estimateDailyNeed({
            fixed: readFixedDays({ built, deadline, input }),
            remaining: requirement.remainingRaw,
          })
        : { basis: "estimated", minutes: null, reason: "noDeadline" },
      finish: estimateFinish({ built, input, remaining: requirement.remainingRaw }),
    },
    phaseDates: readPhaseDates({ built, input }),
    requirement,
    sourceSkillIds: listSourceSkillIds({ built, input }),
    totalMinutes: built.estimate.totalMinutes,
  };
}
