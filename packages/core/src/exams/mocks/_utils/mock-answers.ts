import { type MockAnswer, mockAnswerSchema, mockTextSchema } from "../mock-answer-contract";

export function readMockAnswer(value: unknown): MockAnswer | null {
  return mockAnswerSchema.safeParse(value).data ?? null;
}

export function readMockEssayText(value: unknown): string | null {
  const text = mockTextSchema.safeParse(value).data?.text;
  return text?.trim() ? text : null;
}
