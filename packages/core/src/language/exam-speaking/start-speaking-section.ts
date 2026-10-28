import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getSession } from "../../users/get-session";
import { readLiveCallAdmission } from "../conversations/_utils/live-call-policy";
import { findExamSpeakingSetup, hasSpeakingAccess } from "./_utils/exam-speaking-setup";
import { loadSpeakingSection } from "./_utils/load-speaking-section";
import { type WrittenExamTask, writeExamTask } from "./_utils/write-exam-task";
import { type SpeakingSectionView } from "./speaking-contract";
import { type SpeakingTaskFormat } from "./speaking-format";

export type StartSpeakingSectionResult =
  | { section: SpeakingSectionView; status: "ready" }
  | { status: "callsPaused" | "notLanguage" | "plusRequired" | "unauthorized" };

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

  if ((await readLiveCallAdmission({ transaction: prisma, userId })) === null) {
    return { status: "callsPaused" };
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
