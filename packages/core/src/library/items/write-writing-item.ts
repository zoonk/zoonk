import "server-only";
import { type CallWait } from "@zoonk/ai/provider-options";
import {
  type WritingPromptOutput,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { readExamPicks } from "../../exams/choices/exam-choices";
import { ENEM_WRITING_MAX, hasEnemCompetences } from "../../exams/essays/_utils/enem-writing";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { getWritingScope, toChosenSubjects } from "../../exams/essays/_utils/writing-scope";
import { getWritingTaskBasis } from "../../exams/essays/_utils/writing-task-basis";
import { getNamedEssayRubric } from "../../exams/essays/essay-rubric";
import { writtenItemSchema } from "../../exams/essays/writing-contract";
import { WRITING_CHARACTERS_PER_LINE } from "../../exams/essays/writing-lines";
import { type WritingRequest, findWritingPrompts } from "../../exams/essays/writing-supply";
import { getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getWritingSkillIds } from "../../learner/writing-skills";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { toProvenanceData } from "../_utils/library-rows";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { readBlueprintContent } from "../exams/save-exam-blueprint";
import { createSkill } from "../skills/create-skill";
import { readWritingPool } from "./writing-prompt-pool";

const DRILL_WORD_FLOOR = 5;
const WHOLE_ANSWER_WORD_FLOOR = 30;
const SHORT_ANSWER_WORD_FLOOR = 10;
const MINIMUM_WORDS_PER_LINE = 3;

export function getWritingPromptId(runId: string, slot: number): string {
  return getAnswerAttemptId({ key: String(slot), questionId: runId, userId: "writing-prompt" });
}

export type WritingSupplyInput = Omit<WritingRequest, "count"> & {
  count: number;
  goalId: string;
  userId: string;
  wait?: CallWait;
};

export async function loadWritingSupply(input: WritingSupplyInput) {
  const { goalId, userId } = input;

  const goal = await prisma.goal.findFirst({
    select: {
      examBlueprint: true,
      language: true,
      plan: { select: { graph: true, settings: true } },
    },
    where: { id: goalId, kind: "exam", userId },
  });

  const blueprint = goal?.examBlueprint;

  if (!goal || !blueprint || (blueprint.ownerId !== userId && blueprint.visibility !== "public")) {
    return null;
  }

  const { structure } = readBlueprintContent(blueprint);

  const task = listPracticeWritingTasks({ classTest: Boolean(blueprint.ownerId), structure }).find(
    ({ key }) => key === input.taskKey,
  );

  if (!task) {
    return null;
  }

  const result = await findWritingPrompts({ goalId, requests: [input], tx: prisma, userId });
  const missing = result.status === "missing" ? (result.requests[0]?.count ?? 0) : 0;
  const scope = getWritingScope({ picks: readExamPicks(goal.plan?.settings), structure, task });

  return {
    blueprint,
    chosenSubjects: toChosenSubjects(scope.choices),
    goal,
    missing,
    scope,
    structure,
    task,
  };
}

function getAnswerWordFloor({
  classTest,
  lines,
}: {
  classTest: boolean;
  lines: number | null;
}): number {
  if (classTest) {
    return SHORT_ANSWER_WORD_FLOOR;
  }

  return Math.min(
    WHOLE_ANSWER_WORD_FLOOR,
    (lines ?? WHOLE_ANSWER_WORD_FLOOR) * MINIMUM_WORDS_PER_LINE,
  );
}

type Task = Omit<ReturnType<typeof listPracticeWritingTasks>[number], "subjects">;

function getIssuedTask(
  task: Task,
  namedRubric: ReturnType<typeof getNamedEssayRubric>,
  unit: WritingSupplyInput["unit"],
): Task {
  if (unit === "drill") {
    return task;
  }

  const kind =
    task.grading.kind === "levels" && task.grading.criteria.length === 0
      ? (namedRubric ?? task.grading.kind)
      : task.grading.kind;

  if (kind === "enem") {
    const criteria = hasEnemCompetences(task.grading.criteria) ? task.grading.criteria : [];
    return { ...task, grading: { ...task.grading, criteria, kind }, points: ENEM_WRITING_MAX };
  }

  return kind === task.grading.kind ? task : { ...task, grading: { ...task.grading, kind } };
}

export function promptContent({
  data,
  input,
  skills,
  task,
  issuedTask = task,
  placement,
}: {
  data: WritingPromptOutput;
  issuedTask?: Task;
  input: WritingSupplyInput;
  placement?: { chosenSubjects?: string[]; subject?: string };
  skills: { id: string; name: string }[];
  task: Task;
}) {
  const drill = input.unit === "drill";

  const grading = drill
    ? { criteria: [], kind: "levels" as const, language: null, rounding: null, zeroing: [] }
    : issuedTask.grading;

  const criteria =
    grading.criteria.length > 0
      ? grading.criteria.map(({ id, points, text: name }) => ({ id, name, points }))
      : data.criteria.map((criterion) => ({ ...criterion, points: null }));

  const criterionIds = new Set(criteria.map(({ id }) => id));
  const assessedSkillIds = [...new Set(data.assessedSkillIds)];

  if (
    assessedSkillIds.some((id) => !skills.some((skill) => skill.id === id)) ||
    (drill && (assessedSkillIds.length !== 1 || assessedSkillIds[0] !== input.skillId)) ||
    data.aspects.some(({ criterionId }) => !criterionIds.has(criterionId)) ||
    criterionIds.size !== criteria.length ||
    (grading.kind === "enem" && !hasEnemCompetences(criteria))
  ) {
    throw new Error("Writing prompt does not match its criteria or candidate skills.");
  }

  const writing = writtenItemSchema.parse({
    aspects: data.aspects.map((aspect) => ({
      ...aspect,
      points: grading.criteria.length > 0 ? aspect.points : null,
    })),
    assessedSkillIds,
    charactersPerLine: WRITING_CHARACTERS_PER_LINE,
    criteria,
    grading,
    keySource: "practiceKey",
    lines: drill ? null : task.lines,
    minimumWords: drill
      ? DRILL_WORD_FLOOR
      : getAnswerWordFloor({
          classTest: !task.minutes && task.key === "class-short-answer",
          lines: task.lines,
        }),
    points: drill ? null : issuedTask.points,
    ...placement,
    ...((drill || task !== issuedTask) && { taskBasis: getWritingTaskBasis(task) }),
    taskKey: task.key,
    title: data.title,
    unit: input.unit,
  });

  return {
    context: data.context,
    keyPoints: data.keyPoints,
    question: data.question,
    rubric: criteria.map(({ name }) => ({ criterion: name, description: name, points: null })),
    sampleOutline: data.sampleOutline,
    writing,
  };
}

export async function writeWritingItem(input: WritingSupplyInput, itemId: string) {
  const alreadySaved = await prisma.item.findUnique({
    select: { id: true },
    where: { id: itemId },
  });

  if (alreadySaved) {
    return;
  }

  const supply = await loadWritingSupply(input);

  if (!supply || supply.missing === 0) {
    return;
  }

  const { blueprint, goal, scope, structure, task } = supply;

  const saved = blueprint.ownerId
    ? null
    : await prisma.examSkillGraph.findUnique({
        select: { graph: true },
        where: { examBlueprintId: blueprint.id },
      });

  const graph = parsePlanGraph(
    input.unit === "answer" ? (saved?.graph ?? goal.plan?.graph) : goal.plan?.graph,
  );

  const writtenSkills = getWritingSkillIds({ graph, section: task.section, structure });

  const skillIds =
    writtenSkills.size > 0 || !blueprint.ownerId
      ? writtenSkills
      : new Set(graph.skills.map(({ skillId }) => skillId));

  const skills = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: {
      id: {
        in:
          input.unit === "drill"
            ? [...skillIds].filter((id) => id === input.skillId)
            : [...skillIds],
      },
      language: goal.language,
      mergedIntoId: null,
      ownerId: blueprint.ownerId,
      visibility: blueprint.visibility,
    },
  });

  if (skills.length === 0 && input.unit === "answer") {
    const { skill } = await createSkill({
      country: blueprint.country,
      description: task.description,
      example: null,
      identityKey: scopeIdentityKey({
        key: `written-task:${blueprint.id}:${task.key}`,
        ownerId: blueprint.ownerId,
      }),
      language: goal.language,
      level: null,
      name: task.description,
      ownerId: blueprint.ownerId,
      provenance: blueprint,
      targetLanguage: null,
    });

    skills.push({ id: skill.id, name: skill.name });
  }

  if (skills.length === 0) {
    throw new Error("No eligible skill can anchor this writing drill.");
  }

  const pool = await readWritingPool({
    blueprintId: blueprint.id,
    language: goal.language,
    scope,
    taskKey: task.key,
  });

  const { subjects: _subjects, ...writtenTask } = task;
  const issuedTask = getIssuedTask(writtenTask, getNamedEssayRubric(blueprint), input.unit);

  const { data, provenance } = await writeWritingPrompt({
    analytics: { distinctId: input.userId, goalId: input.goalId },
    input: {
      ...(blueprint.board && { board: blueprint.board }),
      choices: scope.choices,
      drillSkillId: input.skillId ?? null,
      exam: blueprint.name,
      language: goal.language,
      skills,
      subject: pool.subject,
      task: issuedTask,
      unit: input.unit,
      usedTitles: pool.usedTitles,
    },
    shared: blueprint.visibility === "public",
    wait: input.wait ?? "learner",
  });

  const content = promptContent({
    data,
    input,
    issuedTask,
    placement: pool.placement,
    skills,
    task: writtenTask,
  });

  const [skillId] = content.writing.assessedSkillIds;

  if (!skillId) {
    throw new Error("A writing prompt must assess a skill.");
  }

  await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, blueprint.id);

    await tx.item.createMany({
      data: {
        ...toProvenanceData(provenance),
        content,
        examBlueprintId: blueprint.id,
        format: "essay",
        id: itemId,
        language: goal.language,
        skillId,
      },
      skipDuplicates: true,
    });
  });
}
