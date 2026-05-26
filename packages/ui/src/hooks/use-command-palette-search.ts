"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useKeyboardCallback } from "./use-keyboard";

const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

/**
 * A hook that handles common command palette search logic:
 * - Open/close state with Cmd+K keyboard shortcut
 * - Query state with controlled input
 * - Debounced search with useTransition and race condition handling
 * - Minimum query length before searching
 * - Reset on close
 */
export function useCommandPaletteSearch<TResults>(options: {
  debounceMs?: number;
  emptyResults: TResults;
  minQueryLength?: number;
  onSearch: (query: string) => Promise<TResults>;
}): {
  closePalette: () => void;
  isOpen: boolean;
  isPending: boolean;
  onSelectItem: () => void;
  open: () => void;
  query: string;
  results: TResults;
  setQuery: (query: string) => void;
  toggle: () => void;
} {
  const {
    debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
    emptyResults,
    minQueryLength = 2,
    onSearch,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TResults>(emptyResults);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  useKeyboardCallback("k", () => setIsOpen((prev) => !prev), {
    mode: "any",
    modifiers: { ctrlKey: true, metaKey: true },
  });

  const open = useCallback(() => setIsOpen(true), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults(emptyResults);
  }, [emptyResults]);

  const onSelectItem = useCallback(() => {
    closePalette();
  }, [closePalette]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    requestIdRef.current += 1;

    if (trimmedQuery.length < minQueryLength) {
      setResults(emptyResults);
      return;
    }

    const currentRequestId = requestIdRef.current;

    const timeoutId = globalThis.setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await onSearch(trimmedQuery);

          if (currentRequestId === requestIdRef.current) {
            setResults(data);
          }
        } catch {
          if (currentRequestId === requestIdRef.current) {
            setResults(emptyResults);
          }
        }
      });
    }, debounceMs);

    return () => globalThis.clearTimeout(timeoutId);
  }, [query, debounceMs, minQueryLength, onSearch, emptyResults]);

  return { closePalette, isOpen, isPending, onSelectItem, open, query, results, setQuery, toggle };
}
