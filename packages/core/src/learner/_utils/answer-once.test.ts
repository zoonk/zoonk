import { randomUUID } from "node:crypto";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { describe, expect, it } from "vitest";
import { getAnswerAttemptId } from "./answer-once";

describe(getAnswerAttemptId, () => {
  it("gives the same id for the same learner, question and key, and another for anyone else", () => {
    const key = randomUUID();
    const questionId = randomUUID();
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const id = getAnswerAttemptId({ key, questionId, userId });

    expect(uuidSchema().safeParse(id).success).toBe(true);
    expect(getAnswerAttemptId({ key, questionId, userId })).toBe(id);
    expect(getAnswerAttemptId({ key, questionId, userId: otherUserId })).not.toBe(id);
    expect(getAnswerAttemptId({ key, questionId: otherUserId, userId })).not.toBe(id);
    expect(id).not.toBe(key);
  });
});
