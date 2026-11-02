import {
  type SpeakingPaperPlan,
  listSpeakingPaperTasks,
  saveSpeakingPaper,
} from "@zoonk/core/exams/mocks/speaking-paper";
import { type CallWriting } from "@zoonk/core/language/conversations/call-writing";
import { prepareSpeakingMock, writeUnitScenario } from "@zoonk/core/language/conversations/prepare";
import {
  type ExamCardDraft,
  type WrittenExamCard,
  drawExamTaskPhoto,
  needsExamTaskCard,
  saveExamTask,
  writeExamTaskCard,
} from "@zoonk/core/language/exam-speaking/write";

type LearnerGoal = { goalId: string; userId: string };

export type WrittenTaskCard = WrittenExamCard & { task: string };

export async function writeUnitScenarioStep(
  writing: Extract<CallWriting, { kind: "unitScenario" }>,
): Promise<void> {
  "use step";

  await writeUnitScenario(writing);
}

export async function writeSpeakingMockStep(input: LearnerGoal): Promise<void> {
  "use step";

  await prepareSpeakingMock(input);
}

export async function needsExamTaskCardStep(
  input: LearnerGoal & { task: string },
): Promise<boolean> {
  "use step";

  return needsExamTaskCard(input);
}

export async function writeExamCardStep(
  input: LearnerGoal & { previous: { draft: ExamCardDraft; task: string } | null; task: string },
): Promise<ExamCardDraft | null> {
  "use step";

  return writeExamTaskCard(input);
}

export async function drawExamPhotoStep(
  input: LearnerGoal & { alt: string; scene: string },
): Promise<WrittenExamCard["photos"][number]> {
  "use step";

  return drawExamTaskPhoto(input);
}

export async function saveExamTaskStep(
  input: LearnerGoal & { conversationId: string; task: string; written: WrittenExamCard },
): Promise<void> {
  "use step";

  await saveExamTask(input);
}

export async function listSpeakingPaperTasksStep(input: {
  mockId: string;
  userId: string;
}): Promise<SpeakingPaperPlan | null> {
  "use step";

  return listSpeakingPaperTasks(input);
}

export async function saveSpeakingPaperStep(input: {
  cards: WrittenTaskCard[];
  mockId: string;
  plan: SpeakingPaperPlan;
  userId: string;
}): Promise<void> {
  "use step";

  await saveSpeakingPaper(input);
}
