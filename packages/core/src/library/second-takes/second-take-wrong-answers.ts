import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { parseItemContent } from "../items/item-content";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { safeParseStepContent } from "../steps/contract/step-contract";

const MAX_WRONG_ANSWERS = 12;

type SourceQuestion = {
  content: unknown;
  item: { content: unknown; format: string; skillId: string } | null;
  kind: string;
};

function getWrongLanguageOptions(content: unknown) {
  const exercise = safeParseStepContent("multipleChoice", content).data;
  const question = exercise?.question ?? exercise?.context;

  return exercise && question
    ? exercise.options
        .filter((option) => !option.isCorrect)
        .map(({ feedback, text }) => ({ answer: text, question, reason: feedback }))
    : [];
}

function getWrongAnswers({ item, content, kind }: SourceQuestion, skillId: string) {
  if (item?.format === "multipleChoice" && item.skillId === skillId) {
    const parsed = parseItemContent({ content: item.content, format: "multipleChoice" });

    if (parsed.format === "multipleChoice") {
      return parsed.content.options
        .filter((option) => !option.isCorrect)
        .map(({ misconception, reason, text }) => ({
          answer: text,
          question: parsed.content.question,
          reason: misconception ? `${misconception}: ${reason}` : reason,
        }));
    }
  }

  if (kind === "multipleChoice") {
    return getWrongLanguageOptions(content);
  }

  const check = kind === "check" ? safeParseStepContent("check", content).data : null;

  return (
    check?.options
      .filter((option) => !option.isCorrect)
      .map(({ reason, text }) => ({ answer: text, question: check.question, reason })) ?? []
  );
}

export async function loadSecondTakeWrongAnswers({
  db,
  lessonId,
  skillId,
}: {
  db: TransactionClient;
  lessonId: string;
  skillId: string;
}) {
  const questions = await db.step.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      content: true,
      item: { select: { content: true, format: true, skillId: true } },
      kind: true,
    },
    where: {
      ...CURRENT_STEPS,
      AND: [
        { OR: [{ skillId }, { skillId: null }] },
        {
          OR: [
            { kind: { in: ["check", "multipleChoice"] } },
            { item: { format: "multipleChoice", skillId } },
          ],
        },
      ],
      lessonId,
    },
  });

  const wrong = questions.flatMap((question) => getWrongAnswers(question, skillId));

  return [...new Map(wrong.map((answer) => [JSON.stringify(answer), answer])).values()].slice(
    0,
    MAX_WRONG_ANSWERS,
  );
}
