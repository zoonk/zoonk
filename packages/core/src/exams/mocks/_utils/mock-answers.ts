import { type MockAnswer, mockAnswerSchema, mockTextSchema } from "../mock-answer-contract";

/** A stored draft as the learner left it: a pick, a number or text; anything else reads as blank. */
export function readMockAnswer(value: unknown): MockAnswer | null {
  return mockAnswerSchema.safeParse(value).data ?? null;
}

/** An essay's text from its draft, trimmed; null when it was left blank. */
export function readMockEssayText(value: unknown): string | null {
  return mockTextSchema.safeParse(value).data?.text.trim() || null;
}
