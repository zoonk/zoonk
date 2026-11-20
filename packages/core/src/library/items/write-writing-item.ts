import "server-only";
import { type CallWait } from "@zoonk/ai/provider-options";
import {
  type WritingPromptOutput,
  writeWritingPrompt,
} from "@zoonk/ai/tasks/items/write-writing-prompt";
import { prisma } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
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
    select: { examBlueprint: true, language: true, plan: { select: { graph: true } } },
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

  return { blueprint, goal, missing, structure, task };
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

function promptContent({
  data,
  input,
  skills,
  task,
}: {
  data: WritingPromptOutput;
  input: WritingSupplyInput;
  skills: { id: string; name: string }[];
  task: ReturnType<typeof listPracticeWritingTasks>[number];
}) {
  const drill = input.unit === "drill";

  const grading =
    drill || !task.grading
      ? { criteria: [], kind: "levels" as const, language: null, rounding: null, zeroing: [] }
      : task.grading;

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
    criterionIds.size !== criteria.length
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
    points: drill ? null : task.points,
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

  const { blueprint, goal, structure, task } = supply;

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

  const used = await prisma.item.findMany({
    orderBy: { createdAt: "desc" },
    select: { content: true },
    take: 50,
    where: {
      content: { equals: task.key, path: ["writing", "taskKey"] },
      examBlueprintId: blueprint.id,
      format: "essay",
      language: goal.language,
    },
  });

  const usedTitles = used.flatMap(({ content }) => {
    const parsed = promptMetadata(content);
    return parsed ? [parsed] : [];
  });

  const { data, provenance } = await writeWritingPrompt({
    analytics: { distinctId: input.userId, goalId: input.goalId },
    input: {
      drillSkillId: input.skillId ?? null,
      language: goal.language,
      skills,
      task,
      unit: input.unit,
      usedTitles,
    },
    shared: blueprint.visibility === "public",
    wait: input.wait ?? "learner",
  });

  const content = promptContent({ data, input, skills, task });
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

function promptMetadata(content: unknown): string | null {
  return typeof content === "object" && content !== null && "writing" in content
    ? (writtenItemSchema.safeParse(content.writing).data?.title ?? null)
    : null;
}
