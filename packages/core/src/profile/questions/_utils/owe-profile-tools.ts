import { type ProfileQuestion, type TransactionClient } from "@zoonk/db";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";

export async function oweProfileTools({
  tx,
  userId,
  locale,
  memoryEnabled,
  changedQuestions,
}: {
  tx: TransactionClient;
  userId: string;
  locale: SupportedLocale;
  memoryEnabled: boolean;
  changedQuestions: readonly ProfileQuestion[];
}): Promise<void> {
  if (memoryEnabled && changedQuestions.some((id) => id === "work" || id === "studies")) {
    await oweFollowUps({
      db: tx,
      followUps: [{ input: { language: locale }, kind: "suggestProfileTools" }],
      userId,
    });
  }
}
