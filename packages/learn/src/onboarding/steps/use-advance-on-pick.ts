import { useEffect, useRef } from "react";

const ADVANCE_DELAY_MS = 180;

/** Every way of answering goes through here, so they never save twice: `submit` answers at once and drops the queued pick, `cancel` drops it, and a pick while `pending` is ignored. */
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
