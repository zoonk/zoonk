import { type MockAnswer, mockAnswerSchema, mockTextSchema } from "../mock-answer-contract";

export function readMockAnswer(value: unknown): MockAnswer | null {
  return mockAnswerSchema.safeParse(value).data ?? null;
}

export function readMockEssayText(value: unknown): string | null {
  return mockTextSchema.safeParse(value).data?.text.trim() || null;
}
