import { useCallback, useEffect, useRef, useState } from "react";

const COPIED_TIMEOUT_MS = 2000;

export function useClipboard() {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => setIsCopied(false), COPIED_TIMEOUT_MS);
  }, []);

  return { copy, isCopied };
}
