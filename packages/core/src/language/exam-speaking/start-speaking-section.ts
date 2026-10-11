import "server-only";
import { randomUUID } from "node:crypto";
import { getSession } from "../../users/get-session";
import { findExamSpeakingSetup, hasSpeakingAccess } from "./_utils/exam-speaking-setup";
import { loadSpeakingSection } from "./_utils/load-speaking-section";
import { type WrittenExamTask, writeExamTask } from "./_utils/write-exam-task";
import { type SpeakingSectionView } from "./speaking-contract";
import { type SpeakingTaskFormat } from "./speaking-format";

export type StartSpeakingSectionResult =
  | { section: SpeakingSectionView; status: "ready" }
  | { status: "notLanguage" | "plusRequired" | "unauthorized" };

/**
 * Starts a whole speaking paper for the learner's goal, as a mock exam's speaking section: every
 * task's call written now under one section, in the paper's order, each with its own card. A task
 * that continues an earlier one waits for that card and stays on its topic (DELE B1's conversation
 * about the presentation); the others are written at the same time. The calls connect one at a
 * time, each claiming its own call time, so a paper longer than what's left today waits for
 * tomorrow's. Plus only, like every mock exam.
 */
export async function startSpeakingSection({
  goalId,
}: {
  goalId: string;
}): Promise<StartSpeakingSectionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const setup = await findExamSpeakingSetup({ goalId, userId });

  if (!setup) {
    return { status: "notLanguage" };
  }

  if (!(await hasSpeakingAccess())) {
    return { status: "plusRequired" };
  }

  const { format, goal } = setup;
  const sectionId = randomUUID();
  const written = new Map<string, Promise<WrittenExamTask>>();

  const write = (task: SpeakingTaskFormat): Promise<WrittenExamTask> => {
    const started = written.get(task.key);

    if (started) {
      return started;
    }

    const earlier = task.continues
      ? format.tasks.find((item) => item.key === task.continues)
      : undefined;

    const writing = earlier
      ? write(earlier).then((previous) =>
          writeExamTask({ format, goal, previous, sectionId, task }),
        )
      : writeExamTask({ format, goal, sectionId, task });

    written.set(task.key, writing);
    return writing;
  };

  await Promise.all(format.tasks.map((task) => write(task)));

  const section = await loadSpeakingSection({ sectionId, userId });
  return section ? { section, status: "ready" } : { status: "notLanguage" };
}
