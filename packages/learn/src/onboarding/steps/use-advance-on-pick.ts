import { useEffect, useRef } from "react";

/** How long a picked answer stays highlighted before the next question: long enough to see it. */
const ADVANCE_DELAY_MS = 180;

/**
 * A question with one answer moves on once the learner picks it, after a moment with the pick
 * highlighted; a newer pick in that moment replaces it. Every way of answering goes through here,
 * so they never save twice: Continue or Enter (`submit`) answers at once and drops the queued
 * pick, skipping (`cancel`) drops it too, and a pick while the answer saves (`pending`) is
 * ignored. Leaving the screen cancels it. The flow admits one answer at a time on top of this.
 */
export function useAdvanceOnPick<Value>({
  answer,
  pending,
}: {
  answer: (value: Value) => void;
  pending: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const submit = (value: Value) => {
    cancel();
    answer(value);
  };

  const pick = (value: Value) => {
    if (pending) {
      return;
    }

    cancel();
    timer.current = setTimeout(() => submit(value), ADVANCE_DELAY_MS);
  };

  return { cancel, pick, submit };
}
