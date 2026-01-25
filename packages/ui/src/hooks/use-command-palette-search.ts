"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useKeyboardCallback } from "./use-keyboard";

/**
 * A hook that handles common command palette search logic:
 * - Open/close state with Cmd+K keyboard shortcut
 * - Query state with controlled input
 * - Search with useTransition and race condition handling
 * - Minimum query length before searching
 * - Reset on close
 */
export function useCommandPaletteSearch<TResults>(options: {
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
  const { emptyResults, minQueryLength = 2, onSearch } = options;

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

  // Search effect with race condition handling
  useEffect(() => {
    const trimmedQuery = query.trim();

    // Clear results if query is too short
    if (trimmedQuery.length < minQueryLength) {
      setResults(emptyResults);
      return;
    }

    // Increment request ID to handle race conditions
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    startTransition(async () => {
      try {
        const data = await onSearch(trimmedQuery);

        // Only update if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setResults(data);
        }
      } catch {
        if (currentRequestId === requestIdRef.current) {
          setResults(emptyResults);
        }
      }
    });
  }, [query, minQueryLength, onSearch, emptyResults]);

  return {
    closePalette,
    isOpen,
    isPending,
    onSelectItem,
    open,
    query,
    results,
    setQuery,
    toggle,
  };
}
