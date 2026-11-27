import { answerPlacementQuestion } from "../placement/answer-placement-question";
import { startPlacementSitting } from "../placement/start-placement-sitting";
import { lowGuessTapItems } from "./placement-tap-items";

export async function coursePlacementSitting(goalId: string, skillIds: readonly string[]) {
  const banks = await Promise.all(skillIds.map((skillId) => lowGuessTapItems(skillId)));
  const bank = banks.flat();
  const started = await startPlacementSitting({ goalId, input: {} });

  if (started.status !== "ready" || !started.placement.attempt || !started.placement.next) {
    throw new Error("Expected the course test to open");
  }

  const attemptId = started.placement.attempt.id;
  const first = started.placement.next.itemId;

  const answerNext = async (itemId: string) => {
    const tap = bank.find((entry) => entry.item.id === itemId);

    if (!tap) {
      throw new Error("Expected the frozen tap");
    }

    return answerPlacementQuestion({
      goalId,
      input: { answer: tap.answer, attemptId, durationMs: 1000, itemId },
    });
  };

  const answerAll = async (itemId = first): Promise<void> => {
    const response = await answerNext(itemId);

    if (response.status !== "ready") {
      throw new Error("Expected an accepted answer");
    }

    if (response.placement.next) {
      await answerAll(response.placement.next.itemId);
    }
  };

  return { answerAll, answerNext, attemptId, first };
}
