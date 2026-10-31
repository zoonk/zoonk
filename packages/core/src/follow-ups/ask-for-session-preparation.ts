import "server-only";
import { findOwnedStudySession } from "../sessions/_utils/study-session-access";
import { oweFollowUps } from "./owe-follow-ups";

/** For a block opened without being started, such as a plan placeholder whose lesson isn't picked yet. */
export async function askForSessionPreparation({
  sessionId,
}: {
  sessionId: string;
}): Promise<{ status: "asked" | "notFound" | "unauthorized" }> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  await oweFollowUps({
    followUps: [{ input: { sessionId }, kind: "prepareSession" }],
    userId: owned.userId,
  });

  return { status: "asked" };
}
