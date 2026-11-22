import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type FollowUp } from "../../follow-ups/follow-up-contract";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";

export async function oweTestOutChange({
  db,
  userId,
  ...input
}: Extract<FollowUp, { kind: "recordTestOutChange" }>["input"] & {
  db: TransactionClient;
  userId: string;
}) {
  if (input.itemIds.length > 0) {
    await oweFollowUps({ db, followUps: [{ input, kind: "recordTestOutChange" }], userId });
  }
}
