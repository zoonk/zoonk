import { type DuelDecision } from "@zoonk/core/checkpoints/contract";
import { type TricksterActName } from "@zoonk/ui/components/trickster-actor";

/** One mark once a right answer lands, the second from half the shield on; the last one breaks it. */
export function getShieldCracks({ broken, segments }: { broken: number; segments: number }) {
  if (broken <= 0 || segments <= 0) {
    return 0;
  }

  return broken * 2 >= segments ? 2 : 1;
}

/** He reacts to each answer, and to the one that decides the duel with its ending. */
export function getVerdictAct({
  decision,
  isCorrect,
}: {
  decision: DuelDecision | null;
  isCorrect: boolean;
}): TricksterActName {
  if (decision) {
    return decision === "won" ? "defeat" : "triumph";
  }

  return isCorrect ? "sly" : "smug";
}
