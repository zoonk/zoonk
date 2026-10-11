import { isJsonObject } from "@zoonk/utils/json";
import { type MockQuestion } from "../mock-view-contract";

/** How many times the mock played a recording (`MockExam.listeningPlays` by item set id). */
export function readMockPlays({ plays, setId }: { plays: unknown; setId: string }): number {
  const played = isJsonObject(plays) ? plays[setId] : null;
  return typeof played === "number" ? played : 0;
}

/**
 * Each recording of the running section with the plays the mock already counted, so a reload,
 * another tab or another device opens it with the same plays left.
 */
export function listSectionPlays({
  plays,
  questions,
}: {
  plays: unknown;
  questions: readonly Pick<MockQuestion, "set">[];
}): { played: number; setId: string }[] {
  const setIds = new Set(
    questions.flatMap((question) => (question.set?.listening ? [question.set.id] : [])),
  );

  return [...setIds].map((setId) => ({ played: readMockPlays({ plays, setId }), setId }));
}
