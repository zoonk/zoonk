import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  type SpeakingPaperTaskView,
  examSpeakingFeedbackSchema,
  examTaskSnapshotSchema,
} from "../speaking-contract";
import { type SpeakingFormat } from "../speaking-format";
import { getLevelMark, getLevelStanding } from "../speaking-standing";

type LastTry = NonNullable<SpeakingPaperTaskView["lastTry"]>;

/**
 * How a finished try's estimates stand against the exam's level: how many reach it, how many only
 * at the top of their range, out of those it has.
 */
function summarizeTry({
  feedback,
  format,
}: {
  feedback: unknown;
  format: SpeakingFormat;
}): Pick<LastTry, "atLevel" | "nearLevel" | "rated"> {
  const parsed = examSpeakingFeedbackSchema.safeParse(feedback);

  if (!parsed.success) {
    return { atLevel: 0, nearLevel: 0, rated: 0 };
  }

  const standings = parsed.data.criteria.flatMap((grade) => {
    const criterion = format.criteria.find((item) => item.key === grade.criterion);
    return criterion ? [getLevelStanding({ ...grade, levelMark: getLevelMark(criterion) })] : [];
  });

  return {
    atLevel: standings.filter((standing) => standing === "at").length,
    nearLevel: standings.filter((standing) => standing === "near").length,
    rated: standings.length,
  };
}

/**
 * The learner's last finished try of each task of the goal's paper, by task key, so its row can
 * say how it went and open its result again. A whole paper's tasks count too.
 */
export async function loadLastTries({
  format,
  goal,
}: {
  format: SpeakingFormat;
  goal: Pick<Goal, "id" | "userId">;
}): Promise<Map<string, LastTry>> {
  const rows = await prisma.languageConversation.findMany({
    orderBy: { endedAt: "desc" },
    select: { feedback: true, id: true, scenario: true },
    where: { goalId: goal.id, kind: "examSpeaking", status: "completed", userId: goal.userId },
  });

  const tries = new Map<string, LastTry>();

  for (const row of rows) {
    const examTask = isJsonObject(row.scenario) ? row.scenario.examTask : null;
    const snapshot = examTaskSnapshotSchema.safeParse(examTask);
    const task = snapshot.success ? snapshot.data : null;

    if (task && task.exam === format.exam && task.level === format.level && !tries.has(task.task)) {
      tries.set(task.task, {
        conversationId: row.id,
        ...summarizeTry({ feedback: row.feedback, format }),
      });
    }
  }

  return tries;
}
