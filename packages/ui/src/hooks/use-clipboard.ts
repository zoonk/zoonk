import { useState } from "react";

const COPIED_TIMEOUT_MS = 2000;

export function useClipboard() {
  const [isCopied, setIsCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), COPIED_TIMEOUT_MS);
  };

  return { copy, isCopied };
}
