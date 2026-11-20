import { type Goal } from "@zoonk/db";
import { namesMatch } from "../../exams/_utils/name-match";
import { projectWrittenParts } from "../../exams/estimates/written-projection";
import { type WrittenSample, readWrittenSamples } from "../../learner/facts/written-samples";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { getWrittenTestAreas } from "../planner/graph-areas";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { isShortExam } from "../planner/short-exam-plan";
import { getEffectiveCadence, getFinalWeeksStart } from "../planner/written-cadence";
import { type WrittenPractice } from "../written-practice-contract";

function getPlanStart({ createdAt, settings }: { createdAt: Date; settings: PlanSettings }) {
  return settings.startDate ? fromIsoDate(settings.startDate) : fromIsoDate(toIsoDate(createdAt));
}

export function getWrittenPracticeView({
  goal,
  graph,
  noticeParts = [],
  settings,
}: {
  goal: Pick<Goal, "createdAt" | "kind" | "targetDate">;
  graph: PlanGraph;
  noticeParts?: readonly string[];
  settings: PlanSettings;
}): WrittenPractice | null {
  const parts = [...new Set([...getWrittenTestAreas(graph), ...noticeParts])];
  const { targetDate } = goal;
  const planStart = getPlanStart({ createdAt: goal.createdAt, settings });

  if (
    goal.kind !== "exam" ||
    parts.length === 0 ||
    (noticeParts.length === 0 && targetDate && isShortExam({ planStart, targetDate }))
  ) {
    return null;
  }

  const schedule = { cadence: settings.writtenCadence, planStart, targetDate };

  const hasFinalWeeks =
    targetDate !== null &&
    getEffectiveCadence({ ...schedule, cadence: "finalWeeks" }) === "finalWeeks";

  return {
    cadence: getEffectiveCadence(schedule),
    finalWeeksFrom: hasFinalWeeks ? toIsoDate(getFinalWeeksStart({ planStart, targetDate })) : null,
    parts,
  };
}

function toHistory(samples: readonly WrittenSample[]) {
  const groups = new Map<string, { first: WrittenSample; versions: Set<string> }>();
  const history = [];

  for (const sample of samples.toReversed()) {
    const { answer, itemId, mockExamId, studySessionId } = sample;
    const owner = JSON.stringify([mockExamId ?? studySessionId, itemId]);

    if (answer.conditions.version === "firstDraft") {
      const group = { first: sample, versions: new Set([answer.conditions.admissionId]) };
      groups.set(owner, group);
      history.push(group);
    } else {
      groups.get(owner)?.versions.add(answer.conditions.admissionId);
    }
  }

  return history
    .toReversed()
    .map(({ first, versions }) => ({
      attemptId: first.id,
      date: toIsoDate(first.localDate),
      lines: first.prompt.lines,
      range:
        first.numericEligible && first.answer.grade.kind === "points"
          ? first.answer.grade.total
          : null,
      taskKey: first.prompt.taskKey,
      title: first.prompt.title,
      versions: versions.size,
    }));
}

const TREND_SAMPLES = 4;

export async function loadWrittenPracticeView({
  goal,
  graph,
  settings,
  structure,
}: Parameters<typeof getWrittenPracticeView>[0] & {
  goal: Pick<Goal, "id" | "userId">;
  structure: ExamStructure | null;
}): Promise<WrittenPractice | null> {
  const tasks = listWrittenTasks({ structure });

  const base = getWrittenPracticeView({
    goal,
    graph,
    noticeParts: tasks.map((task) => task.section),
    settings,
  });

  if (!base || tasks.length === 0) {
    return base;
  }

  const samples = await readWrittenSamples({ goalId: goal.id, userId: goal.userId });
  const points = projectWrittenParts({ samples, structure });
  const byTask = new Map(tasks.map((task) => [task.key, task.section]));

  return {
    ...base,
    subjects: points.map((part) => {
      const own = samples.filter((sample) => byTask.get(sample.prompt.taskKey) === part.name);
      const ownTasks = tasks.filter((task) => task.section === part.name);

      const share =
        structure?.mock?.scoring.finalShares?.find(
          (term) =>
            term.parts.length === 1 && term.parts.some((name) => namesMatch(name, part.name)),
        )?.share ?? null;

      return {
        answers: toHistory(own),
        minutes: ownTasks[0]?.minutes ?? null,
        points: part,
        questions: ownTasks.reduce((sum, task) => sum + task.count, 0),
        share,
        trend: own
          .filter(
            (sample) =>
              sample.answer.conditions.version === "firstDraft" && sample.prompt.unit === "answer",
          )
          .slice(0, TREND_SAMPLES)
          .toReversed()
          .map(({ answer: { grade }, localDate, numericEligible }) => ({
            contentShare:
              numericEligible && grade.kind === "points"
                ? Math.min(
                    1,
                    Math.max(0, (grade.content.low + grade.content.high) / (2 * grade.max)),
                  )
                : null,
            date: toIsoDate(localDate),
            errors: grade.errors.length,
            presentationShare: null,
          })),
      };
    }),
  };
}
