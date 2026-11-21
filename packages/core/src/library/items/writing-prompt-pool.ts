import "server-only";
import { createHash } from "node:crypto";
import { type CallWait } from "@zoonk/ai/provider-options";
import { prisma } from "@zoonk/db";
import { readExamPicks } from "../../exams/choices/exam-choices";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import {
  type WritingScope,
  getWritingScope,
  isSameWritingScope,
  pickWritingSubject,
  toChosenSubjects,
} from "../../exams/essays/_utils/writing-scope";
import { writtenItemSchema } from "../../exams/essays/writing-contract";
import { type WritingRequest, findWritingPrompts } from "../../exams/essays/writing-supply";
import { readBlueprintContent } from "../exams/save-exam-blueprint";
import { fitsWrittenSitting } from "../exams/written-grading";

const USED_PROMPTS = 50;

function readWriting(content: unknown) {
  return typeof content === "object" && content !== null && "writing" in content
    ? (writtenItemSchema.safeParse(content.writing).data ?? null)
    : null;
}

/**
 * What the next prompt of a task's pool is written on: the subject its earlier prompts used least,
 * the titles they took, and the scope the new prompt records so only that pool's learners get it.
 */
export async function readWritingPool({
  blueprintId,
  language,
  scope,
  taskKey,
}: {
  blueprintId: string;
  language: string;
  scope: WritingScope;
  taskKey: string;
}) {
  const chosenSubjects = toChosenSubjects(scope.choices);

  const items = await prisma.item.findMany({
    orderBy: { createdAt: "desc" },
    select: { content: true },
    take: USED_PROMPTS,
    where: {
      AND: [
        { content: { equals: taskKey, path: ["writing", "taskKey"] } },
        ...(chosenSubjects.length > 0
          ? [{ content: { equals: chosenSubjects, path: ["writing", "chosenSubjects"] } }]
          : []),
      ],
      examBlueprintId: blueprintId,
      format: "essay",
      language,
    },
  });

  const used = items.flatMap(({ content }) => {
    const prompt = readWriting(content);
    return prompt && isSameWritingScope({ choices: scope.choices, prompt }) ? [prompt] : [];
  });

  const subject = pickWritingSubject({ scope, used: used.map((prompt) => prompt.subject) });

  return {
    placement: {
      ...(chosenSubjects.length > 0 && { chosenSubjects }),
      ...(subject && { subject: subject.name }),
    },
    subject,
    usedTitles: used.map((prompt) => prompt.title),
  };
}

export type WritingSupplyInput = Omit<WritingRequest, "count"> & {
  count: number;
  goalId: string;
  userId: string;
  wait?: CallWait;
};

export async function loadWritingSupply(input: WritingSupplyInput, expectedPoolToken?: string) {
  if (!fitsWrittenSitting(input.count)) {
    return null;
  }

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

  const scope = getWritingScope({ picks: readExamPicks(goal.plan?.settings), structure, task });

  if (!scope.available) {
    return null;
  }

  const key = JSON.stringify([
    blueprint.id,
    goal.language,
    task.key,
    input.unit,
    input.unit === "drill" ? input.skillId : null,
    toChosenSubjects(scope.choices),
  ]);

  const poolToken = `writing-pool:${createHash("sha256").update(key).digest("hex")}`;

  if (expectedPoolToken && poolToken !== expectedPoolToken) {
    return null;
  }

  const result = await findWritingPrompts({ goalId, requests: [input], tx: prisma, userId });
  const missing = result.status === "missing" ? (result.requests[0]?.count ?? 0) : 0;

  return { blueprint, goal, missing, poolToken, scope, structure, task };
}
