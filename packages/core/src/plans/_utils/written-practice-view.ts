import { type Goal, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { namesMatch } from "../../exams/_utils/name-match";
import { toChosenStructure } from "../../exams/choices/exam-choices";
import { unfinishedExtraWritingWhere } from "../../exams/essays/_utils/extra-writing-blocks";
import { getWritingScope, writingNeedsChoice } from "../../exams/essays/_utils/writing-scope";
import { projectWrittenParts } from "../../exams/estimates/written-projection";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readExtraWritingLimit } from "../../learner/facts/extra-writing";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { type WrittenSample, readWrittenSamples } from "../../learner/facts/written-samples";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../library/exams/written-tasks";
import { readBlockPayload } from "../../sessions/block-payload";
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
      estimatedLines: first.answer.conditions.estimatedLines,
      lines: first.prompt.lines,
      range:
        first.numericEligible && first.answer.grade.kind === "points"
          ? first.answer.grade.total
          : null,
      taskKey: first.prompt.taskKey,
      title: first.prompt.title,
      unit: first.prompt.unit,
      versions: versions.size,
    }));
}

async function loadWriteActions({
  goal,
  tasks,
}: {
  goal: Pick<Goal, "id" | "timezone" | "userId">;
  tasks: ReturnType<typeof listWrittenTasks>;
}) {
  const { id: goalId, userId } = goal;

  const [blocks, limit] = await Promise.all([
    prisma.studySessionBlock.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, payload: true },
      where: {
        ...unfinishedExtraWritingWhere({ goalId, userId }),
        OR: tasks.map(({ key }) => ({ payload: { equals: key, path: ["writing", "taskKey"] } })),
      },
    }),
    getRequestInstant().then((date) =>
      readExtraWritingLimit(
        userId,
        toIsoDate(getDateInTimeZone({ date, timeZone: getAnswerTimeZone({ goal }) })),
      ),
    ),
  ]);

  const byTask = Map.groupBy(
    blocks.map((block) => ({ id: block.id, writing: readBlockPayload(block).writing })),
    ({ writing }) => writing?.taskKey,
  );

  return ({ key: taskKey }: ReturnType<typeof listWrittenTasks>[number]) => {
    const block = byTask.get(taskKey)?.[0];

    if (block?.writing?.admissionId) {
      return { availability: { status: "continue" as const }, blockId: block.id, taskKey };
    }

    const availability = limit
      ? { returnsOn: limit.returnsOn, status: "tomorrow" as const }
      : { status: "available" as const };

    return { availability, blockId: block?.id, taskKey };
  };
}

const PRESENTATION_WORD =
  /(?:^|[^a-z])(?:presentation|structure|apresentacao|estrutura)(?:$|[^a-z])/u;

const LEVEL_SHARE = { complete: 1, missing: 0, partial: 1 / 3, strong: 2 / 3 };

function presentationShare({ answer: { grade }, numericEligible, prompt }: WrittenSample) {
  const criteria = new Set(
    prompt.criteria.flatMap(({ id, name }) =>
      PRESENTATION_WORD.test(normalizeString(`${id} ${name}`)) ? [id] : [],
    ),
  );

  if (numericEligible && grade.kind === "points") {
    const rows = grade.rows.filter(({ id }) => criteria.has(id));
    const max = rows.reduce((sum, row) => sum + row.max, 0);

    const earned = rows.reduce(
      (sum, row) => sum + (row.range ? (row.range.low + row.range.high) / 2 : row.earned),
      0,
    );

    if (max > 0) {
      return Math.min(1, Math.max(0, earned / max));
    }
  }

  const levels = grade.criteria.filter(({ id }) => criteria.has(id));

  return levels.length > 0
    ? levels.reduce((sum, { level }) => sum + LEVEL_SHARE[level], 0) / levels.length
    : null;
}

const TREND_SAMPLES = 4;

export async function loadWrittenPracticeView({
  goal,
  graph,
  settings,
  structure,
}: Parameters<typeof getWrittenPracticeView>[0] & {
  goal: Pick<Goal, "id" | "timezone" | "userId">;
  structure: ExamStructure | null;
}): Promise<WrittenPractice | null> {
  const chosen = structure
    ? toChosenStructure({ includePendingWriting: true, picks: settings, structure })
    : null;

  const tasks = listWrittenTasks({ structure: chosen });

  const base = getWrittenPracticeView({
    goal,
    graph,
    noticeParts: tasks.map((task) => task.section),
    settings,
  });

  if (!base || !structure || tasks.length === 0) {
    return base;
  }

  const scopes = new Map(
    tasks.map((task) => [task.key, getWritingScope({ picks: settings, structure, task })]),
  );

  const writable = tasks.filter(({ key }) => scopes.get(key)?.available);

  const [samples, writeAction] = await Promise.all([
    readWrittenSamples({ goalId: goal.id, userId: goal.userId }),
    writable.length > 0 ? loadWriteActions({ goal, tasks: writable }) : null,
  ]);

  const points = projectWrittenParts({ samples, structure: chosen });
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
        availability: writingNeedsChoice(
          ownTasks.flatMap(({ key }) => scopes.get(key)?.missingChoices ?? []),
        ),
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
          .map((sample) => {
            const {
              answer: { grade },
              localDate,
              numericEligible,
            } = sample;

            return {
              contentShare:
                numericEligible && grade.kind === "points"
                  ? Math.min(
                      1,
                      Math.max(0, (grade.content.low + grade.content.high) / (2 * grade.max)),
                    )
                  : null,
              date: toIsoDate(localDate),
              errors: grade.errorCount,
              presentationShare: presentationShare(sample),
            };
          }),
        writeActions: ownTasks.flatMap<
          NonNullable<NonNullable<WrittenPractice["subjects"]>[number]["writeActions"]>[number]
        >((task) => {
          const scope = scopes.get(task.key);
          const availability = writingNeedsChoice(scope?.missingChoices ?? []);

          if (availability) {
            return [{ availability, taskKey: task.key }];
          }

          const action = scope?.available && writeAction?.(task);
          return action ? [action] : [];
        }),
      };
    }),
  };
}
