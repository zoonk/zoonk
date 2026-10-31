import { isJsonObject } from "@zoonk/utils/json";
import { type MockQuestion } from "../mock-view-contract";

export function readMockPlays({ plays, setId }: { plays: unknown; setId: string }): number {
  const played = isJsonObject(plays) ? plays[setId] : null;
  return typeof played === "number" ? played : 0;
}

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
