import { randomUUID } from "node:crypto";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { claimDailyInsight, saveDailyInsight, writeDailyInsight } from "../insights/daily-insight";
import { proposeSessionMemory, rememberMemoryCandidate } from "../memory-follow-ups";
import { gateMemoryCandidate } from "../remember-candidate";

/** After the fixtures' answers, which land at noon UTC today at the latest. */
function afterTodaysAnswers(): Date {
  return new Date(Math.max(Date.now(), new Date().setUTCHours(12, 0, 0, 0)) + 1000);
}

/** Runs a session end's owed memory and insight in the follow-up workflow's order of steps. */
export async function runSessionFollowUps({
  endedAt = afterTodaysAnswers(),
  goalId,
  sessionId = randomUUID(),
  timeZone = "UTC",
  userId,
}: {
  endedAt?: Date;
  goalId: string;
  sessionId?: string;
  timeZone?: string;
  userId: string;
}): Promise<void> {
  const end = { endedAt: endedAt.toISOString(), goalId, timeZone, userId };
  const proposed = await proposeSessionMemory({ ...end, sessionId });

  for (const candidate of proposed?.candidates ?? []) {
    // oxlint-disable-next-line no-await-in-loop -- Each candidate sees what the previous one changed.
    const gate = await gateMemoryCandidate(candidate);

    if (gate && proposed) {
      // oxlint-disable-next-line no-await-in-loop -- Each candidate sees what the previous one changed.
      await rememberMemoryCandidate({ candidate, context: proposed.context, gate });
    }
  }

  const insight = await writeSessionInsight({ endedAt, goalId, timeZone, userId });

  if (insight) {
    await saveDailyInsight({ ...insight, userId });
  }
}

/** The day's insight claimed and written, as the steps before its save leave it. */
export async function writeSessionInsight({
  endedAt = afterTodaysAnswers(),
  goalId,
  timeZone = "UTC",
  userId,
}: {
  endedAt?: Date;
  goalId: string;
  timeZone?: string;
  userId: string;
}) {
  const end = { endedAt: endedAt.toISOString(), goalId, timeZone, userId };
  const date = getDateInTimeZone({ date: endedAt, timeZone }).toISOString().slice(0, 10);
  const claim = await claimDailyInsight({ ...end, date });

  return claim ? { claim, written: await writeDailyInsight({ ...end, claim }) } : null;
}
