import { type MockView } from "@zoonk/core/exams/mocks/contract";

/** The finished mock whose mistakes can be practiced now; null when it has none left to practice. */
export function getPracticedMock({
  mockId,
  practiceAvailable,
  purpose,
}: Pick<MockView, "mockId" | "practiceAvailable" | "purpose">): string | null {
  return purpose !== "placement" && practiceAvailable ? mockId : null;
}
