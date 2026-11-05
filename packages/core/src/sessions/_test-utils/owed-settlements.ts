import { listFollowUps } from "../../follow-ups/follow-up-rows";
import { settleOwedSessionDay } from "../settle-owed-session-day";

/** What the API's follow-up run does with each day settlement a finished block owed. */
export async function runOwedSettlements(userId: string): Promise<void> {
  const owed = await listFollowUps(userId);

  await Promise.all(
    owed.flatMap((row) =>
      row.kind === "settleSessionDay" ? [settleOwedSessionDay({ ...row.input, userId })] : [],
    ),
  );
}
