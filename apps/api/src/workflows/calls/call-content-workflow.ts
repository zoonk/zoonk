import {
  type CallWriting,
  getCallWritingKey,
} from "@zoonk/core/language/conversations/call-writing";
import { CALL_READY_STEP, type CallWritingStepName } from "@zoonk/core/library/generation/steps";
import { type QuestionWritingResult, runQuestionWriting } from "../goals/question-writing-run";
import {
  type WrittenTaskCard,
  drawExamPhotoStep,
  listSpeakingPaperTasksStep,
  needsExamTaskCardStep,
  saveExamTaskStep,
  saveSpeakingPaperStep,
  writeExamCardStep,
  writeSpeakingMockStep,
  writeUnitScenarioStep,
} from "./steps/call-writing-steps";

type LearnerGoal = { goalId: string; userId: string };

async function writeTaskCard({
  previous,
  task,
  ...learner
}: LearnerGoal & {
  previous: WrittenTaskCard | null;
  task: string;
}): Promise<WrittenTaskCard | null> {
  const draft = await writeExamCardStep({
    ...learner,
    previous: previous ? { draft: previous.draft, task: previous.task } : null,
    task,
  });

  if (!draft) {
    return null;
  }

  const photos = await Promise.all(
    draft.photos.map((photo) => drawExamPhotoStep({ ...learner, ...photo })),
  );

  return { draft, photos, task };
}

async function writeExamTask(input: LearnerGoal & { task: string }): Promise<void> {
  if (!(await needsExamTaskCardStep(input))) {
    return;
  }

  const written = await writeTaskCard({ ...input, previous: null });

  if (written) {
    await saveExamTaskStep({ ...input, written });
  }
}

/** A task that continues another is written from that card, as the exam's second part follows its first. */
async function writeSpeakingPaper(sitting: { mockId: string; userId: string }): Promise<void> {
  const paper = await listSpeakingPaperTasksStep(sitting);

  if (!paper) {
    return;
  }

  const learner = { goalId: paper.goalId, userId: sitting.userId };
  const written = new Map<string, Promise<WrittenTaskCard | null>>();

  const write = (key: string): Promise<WrittenTaskCard | null> => {
    const task = paper.tasks.find((item) => item.key === key);
    const started = written.get(key);

    if (!task || started) {
      return started ?? Promise.resolve(null);
    }

    const writing = (task.continues ? write(task.continues) : Promise.resolve(null)).then(
      (previous) => writeTaskCard({ ...learner, previous, task: key }),
    );

    written.set(key, writing);
    return writing;
  };

  const cards = await Promise.all(paper.tasks.map((task) => write(task.key)));

  await saveSpeakingPaperStep({ ...sitting, cards: cards.filter((card) => card !== null) });
}

async function writeCall(writing: CallWriting): Promise<"written"> {
  switch (writing.kind) {
    case "examTask":
      await writeExamTask(writing);
      break;
    case "speakingMock":
      await writeSpeakingMockStep(writing);
      break;
    case "speakingPaper":
      await writeSpeakingPaper(writing);
      break;
    case "unitScenario":
      await writeUnitScenarioStep(writing);
      break;
    default:
      writing satisfies never;
  }

  return "written";
}

/** One run per writing key: a learner's start, session preparation and the review ahead join it. */
export async function callContentWorkflow(writing: CallWriting): Promise<QuestionWritingResult> {
  "use workflow";

  return runQuestionWriting<CallWritingStepName>({
    steps: { join: "joinRunningCall", ready: CALL_READY_STEP, write: "writeCall" },
    token: getCallWritingKey(writing),
    write: () => writeCall(writing),
  });
}
