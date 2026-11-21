import "server-only";
import { prisma } from "@zoonk/db";
import {
  type WritingScope,
  isSameWritingScope,
  pickWritingSubject,
  toChosenSubjects,
} from "../../exams/essays/_utils/writing-scope";
import { writtenItemSchema } from "../../exams/essays/writing-contract";

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
