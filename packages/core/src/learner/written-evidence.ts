import { type Item, type TransactionClient } from "@zoonk/db";
import { type WritingConditions, type WritingResult } from "../exams/essays/writing-contract";

export function creditWrittenSkills(_input: {
  tx: TransactionClient;
  attemptId: string;
  item: Item;
  conditions: WritingConditions;
  grade: WritingResult;
}): Promise<void> {
  return Promise.reject(
    new Error("Written skill credit requires the writing evidence capability."),
  );
}
