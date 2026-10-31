import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, sql } from "@zoonk/db";
import { findExamSpeakingSetup } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import {
  type WrittenExamCard,
  toExamTaskConversation,
} from "../../language/exam-speaking/_utils/write-exam-task";
import { type SpeakingFormat } from "../../language/exam-speaking/speaking-format";
import { getSpeakingTask } from "../../language/exam-speaking/speaking-formats";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { mockConditionsSchema } from "./mock-contract";

type SittingPaper = { mockId: string; userId: string };

type SpeakingPaperTask = { continues: string | null; key: string };

/** The paper the cards were written for: its exam, level and every task. */
export type SpeakingPaperPlan = {
  exam: SpeakingFormat["exam"];
  goalId: string;
  level: SpeakingFormat["level"];
  tasks: SpeakingPaperTask[];
};

function toTaskKeys(keys: readonly string[]): string {
  return keys.toSorted().join(",");
}

function isWholePaper({
  cards,
  format,
  plan,
}: {
  cards: readonly { task: string }[];
  format: SpeakingFormat;
  plan: SpeakingPaperPlan;
}): boolean {
  return (
    format.exam === plan.exam &&
    format.level === plan.level &&
    toTaskKeys(format.tasks.map((task) => task.key)) === toTaskKeys(cards.map((card) => card.task))
  );
}

async function findUnwrittenPaper({ mockId, userId }: SittingPaper) {
  const mock = await prisma.mockExam.findFirst({
    select: { conditions: true, goalId: true },
    where: { id: mockId, status: "active", userId },
  });

  const sections = mockConditionsSchema.safeParse(mock?.conditions).data?.sections ?? [];
  const index = sections.findIndex((section) => section.kind === "speaking");
  const slot = sections[index];

  if (!mock?.goalId || !slot || slot.speakingSectionId) {
    return null;
  }

  const setup = await findExamSpeakingSetup({ goalId: mock.goalId, userId });
  return setup ? { ...setup, index } : null;
}

/**
 * Internal, for the call writing workflow: `userId` comes from the capability that started the
 * sitting. Null once the sitting's paper is bound, or when it has no speaking part.
 */
export async function listSpeakingPaperTasks(
  sitting: SittingPaper,
): Promise<SpeakingPaperPlan | null> {
  const paper = await findUnwrittenPaper(sitting);

  if (!paper) {
    return null;
  }

  const { exam, level, tasks } = paper.format;
  const keys = tasks.map((task) => ({ continues: task.continues ?? null, key: task.key }));

  return { exam, goalId: paper.goal.id, level, tasks: keys };
}

/**
 * Binds the whole paper to the sitting's speaking part in the transaction that saves its calls, so
 * a sitting never shows half a paper and a second writer binds nothing. Cards written for a paper
 * the goal no longer has bind nothing either; the next start writes the current one.
 */
export async function saveSpeakingPaper({
  cards,
  plan,
  ...sitting
}: SittingPaper & {
  cards: (WrittenExamCard & { task: string })[];
  plan: SpeakingPaperPlan;
}): Promise<void> {
  const paper = await findUnwrittenPaper(sitting);

  if (!paper || !isWholePaper({ cards, format: paper.format, plan })) {
    return;
  }

  const sectionId = randomUUID();

  const calls = cards.flatMap(({ task, ...written }) => {
    const format = getSpeakingTask({ format: paper.format, task });

    return format
      ? [
          toExamTaskConversation({
            format: paper.format,
            goal: paper.goal,
            sectionId,
            task: format,
            written,
          }),
        ]
      : [];
  });

  await writeLearnerChange({ userId: sitting.userId }, async (tx) => {
    const bound = await tx.$executeRaw(sql`
    UPDATE mock_exams
    SET conditions = jsonb_set(conditions, ARRAY['sections', ${String(paper.index)}, 'speakingSectionId'], to_jsonb(${sectionId}::text)),
        updated_at = now()
    WHERE id = ${sitting.mockId}::uuid
      AND status = 'active'
      AND conditions -> 'sections' -> ${paper.index}::int ->> 'speakingSectionId' IS NULL
  `);

    if (bound === 0) {
      return unchanged(null);
    }

    await tx.languageConversation.createMany({ data: calls });
    return null;
  });
}
