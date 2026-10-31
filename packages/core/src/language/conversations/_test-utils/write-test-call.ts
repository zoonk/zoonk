import { randomUUID } from "node:crypto";
import {
  listSpeakingPaperTasks,
  saveSpeakingPaper,
} from "../../../exams/mocks/mock-speaking-paper";
import {
  type ExamCardDraft,
  drawExamTaskPhoto,
  needsExamTaskCard,
  saveExamTask,
  writeExamTaskCard,
} from "../../exam-speaking/write-exam-speaking";
import { type CallWriting } from "../call-writing-contract";
import { type LanguageConversationStartInput } from "../conversation-contract";
import { prepareSpeakingMock, writeUnitScenario } from "../prepare-language-calls";
import { startLanguageConversation } from "../start-language-conversation";

type LearnerGoal = { goalId: string; userId: string };

type TaskCard = { draft: ExamCardDraft; photos: { alt: string; url: string }[]; task: string };

async function writeTaskCard({
  previous,
  task,
  ...learner
}: LearnerGoal & { previous: TaskCard | null; task: string }): Promise<TaskCard | null> {
  const draft = await writeExamTaskCard({ ...learner, previous, task });

  if (!draft) {
    return null;
  }

  const photos = await Promise.all(
    draft.photos.map((photo) => drawExamTaskPhoto({ ...learner, ...photo })),
  );

  return { draft, photos, task };
}

async function writePaper(sitting: { mockId: string; userId: string }): Promise<void> {
  const paper = await listSpeakingPaperTasks(sitting);

  if (!paper) {
    return;
  }

  const learner = { goalId: paper.goalId, userId: sitting.userId };
  const cards: TaskCard[] = [];

  for (const task of paper.tasks) {
    const previous = cards.find((card) => card.task === task.continues) ?? null;
    // oxlint-disable-next-line eslint/no-await-in-loop -- A task that continues another is written from that card.
    const card = await writeTaskCard({ ...learner, previous, task: task.key });

    if (card) {
      cards.push(card);
    }
  }

  await saveSpeakingPaper({ ...sitting, cards, plan: paper });
}

/** What the API's call writing workflow runs, as steps one after another. */
export async function writeTestCall(writing: CallWriting): Promise<void> {
  switch (writing.kind) {
    case "examTask": {
      if (!(await needsExamTaskCard(writing))) {
        return;
      }

      const written = await writeTaskCard({ ...writing, previous: null });

      if (written) {
        await saveExamTask({ ...writing, conversationId: randomUUID(), written });
      }

      return;
    }
    case "speakingMock":
      return prepareSpeakingMock(writing);
    case "speakingPaper":
      return writePaper(writing);
    case "unitScenario":
      return writeUnitScenario(writing);
    default:
      return writing satisfies never;
  }
}

/** A start the server answers with a writing is written, then sent again, as a client does. */
export async function startWrittenCall(input: LanguageConversationStartInput) {
  const started = await startLanguageConversation(input);

  if (started.status !== "preparing") {
    return started;
  }

  await writeTestCall(started.writing);
  return startLanguageConversation(input);
}
