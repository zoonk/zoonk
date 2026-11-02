import "server-only";
import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type ExamSpeakingSetup, findExamSpeakingSetup } from "./_utils/exam-speaking-setup";
import { drawSpeakingPhoto } from "./_utils/speaking-photos";
import { findWaitingExamTask } from "./_utils/start-exam-task";
import {
  type ExamCardDraft,
  type WrittenExamCard,
  toExamTaskConversation,
  writeExamCard,
} from "./_utils/write-exam-task";
import { type SpeakingCard } from "./speaking-contract";
import { type SpeakingTaskFormat } from "./speaking-format";
import { getSpeakingTask } from "./speaking-formats";

export { type ExamCardDraft, type WrittenExamCard } from "./_utils/write-exam-task";

type LearnerGoal = { goalId: string; userId: string };

async function findTaskSetup({
  goalId,
  task,
  userId,
}: LearnerGoal & { task: string }): Promise<
  (ExamSpeakingSetup & { task: SpeakingTaskFormat }) | null
> {
  const setup = await findExamSpeakingSetup({ goalId, userId });
  const taskFormat = setup ? getSpeakingTask({ format: setup.format, task }) : null;
  return setup && taskFormat ? { ...setup, task: taskFormat } : null;
}

/**
 * Internal, for the call writing workflow: `userId` comes from the capability that asked for the
 * card. Null when the goal has no such task.
 */
export async function writeExamTaskCard({
  goalId,
  previous,
  task,
  userId,
}: LearnerGoal & {
  previous: { draft: ExamCardDraft; task: string } | null;
  task: string;
}): Promise<ExamCardDraft | null> {
  const setup = await findTaskSetup({ goalId, task, userId });

  if (!setup) {
    return null;
  }

  const previousTask = previous
    ? getSpeakingTask({ format: setup.format, task: previous.task })
    : null;

  return writeExamCard({
    format: setup.format,
    goal: setup.goal,
    previous: previous && previousTask ? { draft: previous.draft, task: previousTask } : null,
    task: setup.task,
  });
}

export function drawExamTaskPhoto({
  alt,
  goalId,
  scene,
  userId,
}: LearnerGoal & { alt: string; scene: string }): Promise<SpeakingCard["photos"][number]> {
  return drawSpeakingPhoto({
    alt,
    analytics: { contentScope: "personal", distinctId: userId, goalId },
    scene,
  });
}

export async function needsExamTaskCard(input: LearnerGoal & { task: string }): Promise<boolean> {
  const setup = await findTaskSetup(input);
  return setup !== null && (await findWaitingExamTask(setup)) === null;
}

/** Saved under the id its run chose, so a save that runs again adds no second copy. */
export async function saveExamTask({
  conversationId,
  written,
  ...input
}: LearnerGoal & {
  conversationId: string;
  task: string;
  written: WrittenExamCard;
}): Promise<void> {
  const setup = await findTaskSetup(input);

  if (!setup) {
    return;
  }

  const card = { ...toExamTaskConversation({ ...setup, written }), id: conversationId };

  await writeLearnerChange({ userId: input.userId }, (tx) =>
    tx.languageConversation.createMany({ data: [card], skipDuplicates: true }),
  );
}
