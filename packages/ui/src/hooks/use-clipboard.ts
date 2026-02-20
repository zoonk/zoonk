import { useCallback, useEffect, useState } from "react";

const COPIED_TIMEOUT_MS = 2000;

export function useClipboard() {
  const [copiedAt, setCopiedAt] = useState(0);

  useEffect(() => {
    if (copiedAt === 0) {
      return;
    }

    const timer = setTimeout(() => setCopiedAt(0), COPIED_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [copiedAt]);

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAt(Date.now());
  }, []);

  return { copy, isCopied: copiedAt > 0 };
}
