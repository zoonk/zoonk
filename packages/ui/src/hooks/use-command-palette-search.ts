"use client";

import { type RefObject, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useKeyboardCallback } from "./use-keyboard";

const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

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
  returnFocusRef: RefObject<HTMLElement | null>;
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
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    if (isOpen) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    setIsOpen(true);
  }, [isOpen]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (value.trim().length < minQueryLength) {
        requestIdRef.current += 1;
        setResults(emptyResults);
      }
    },
    [emptyResults, minQueryLength],
  );

  const closePalette = useCallback(() => {
    requestIdRef.current += 1;
    setIsOpen(false);
    setQuery("");
    setResults(emptyResults);
  }, [emptyResults]);

  const toggle = useCallback(() => {
    if (isOpen) {
      closePalette();
      return;
    }

    open();
  }, [closePalette, isOpen, open]);

  useKeyboardCallback("k", toggle, { mode: "any", modifiers: { ctrlKey: true, metaKey: true } });

  const onSelectItem = useCallback(() => {
    closePalette();
  }, [closePalette]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    requestIdRef.current += 1;

    if (trimmedQuery.length < minQueryLength) {
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

  return {
    closePalette,
    isOpen,
    isPending,
    onSelectItem,
    open,
    query,
    results: query.trim().length < minQueryLength ? emptyResults : results,
    returnFocusRef,
    setQuery: handleQueryChange,
    toggle,
  };
}
