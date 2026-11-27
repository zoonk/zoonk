import "server-only";
import {
  type WritingPromptOutput,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { ENEM_WRITING_MAX, hasEnemCompetences } from "../../exams/essays/_utils/enem-writing";
import { type listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { getWritingTaskBasis } from "../../exams/essays/_utils/writing-task-basis";
import { type WritingPrompt, writtenItemSchema } from "../../exams/essays/writing-contract";
import { WRITING_CHARACTERS_PER_LINE } from "../../exams/essays/writing-lines";
import { getWrittenPartMinimum } from "../../exams/scoring/written-points";
import { getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { getWritingSkillIds } from "../../learner/writing-skills";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { toProvenanceData } from "../_utils/library-rows";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { createSkill } from "../skills/create-skill";
import { requireWritingPromptSpend } from "./_utils/writing-prompt-spend";
import { type WritingSupplyInput, loadWritingSupply, readWritingPool } from "./writing-prompt-pool";

const DRILL_WORD_FLOOR = 5;
const WHOLE_ANSWER_WORD_FLOOR = 30;
const SHORT_ANSWER_WORD_FLOOR = 10;
const MINIMUM_WORDS_PER_LINE = 3;

/** @internal */
export function getWritingPromptId(runId: string, slot: number): string {
  return getAnswerAttemptId({ key: String(slot), questionId: runId, userId: "writing-prompt" });
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

function getIssuedTask(task: Task, unit: WritingSupplyInput["unit"]): Task {
  if (unit === "drill" || task.grading.kind !== "enem") {
    return task;
  }

  const criteria = hasEnemCompetences(task.grading.criteria) ? task.grading.criteria : [];
  return { ...task, grading: { ...task.grading, criteria }, points: ENEM_WRITING_MAX };
}

export function promptContent({
  data,
  input,
  partMinimum,
  skills,
  task,
  issuedTask = task,
  placement,
}: {
  data: WritingPromptOutput;
  issuedTask?: Task;
  input: WritingSupplyInput;
  partMinimum?: WritingPrompt["partMinimum"];
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
    part: task.section,
    ...(!drill && partMinimum && { partMinimum }),
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

export async function writeWritingItem({
  input,
  poolToken,
  runId,
  slot,
}: {
  input: WritingSupplyInput;
  poolToken: string;
  runId: string;
  slot: number;
}) {
  const itemId = getWritingPromptId(runId, slot);

  const alreadySaved = await prisma.item.findUnique({
    select: { id: true },
    where: { id: itemId },
  });

  if (alreadySaved) {
    return;
  }

  const supply = await loadWritingSupply(input, poolToken);

  if (!supply || supply.missing === 0) {
    return;
  }

  await requireWritingPromptSpend({ runId, slot, userId: input.userId });

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
  const issuedTask = getIssuedTask(writtenTask, input.unit);

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
    partMinimum: getWrittenPartMinimum({ structure, taskKey: task.key }),
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
