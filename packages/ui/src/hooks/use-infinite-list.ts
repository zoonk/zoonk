"use client";

import { useCallback, useRef, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";

type UseInfiniteListOptions<T, C> = {
  initialItems: T[];
  limit: number;
  getCursor: (item: T) => C;
  fetchMore: (cursor: C) => Promise<T[]>;
  getKey: (item: T) => string | number;
  rootMargin?: string;
};

type UseInfiniteListReturn<T> = {
  hasNextPage: boolean;
  isLoading: boolean;
  items: T[];
  sentryRef: (node: Element | null) => void;
};

export function useInfiniteList<T, C>({
  fetchMore,
  getCursor,
  getKey,
  initialItems,
  limit,
  rootMargin = "0px 0px 200px 0px",
}: UseInfiniteListOptions<T, C>): UseInfiniteListReturn<T> {
  const [items, setItems] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(initialItems.length >= limit);

  // Use ref to track the latest cursor to avoid stale closures
  const lastItem = initialItems.at(-1);
  const cursorRef = useRef<C | undefined>(
    lastItem ? getCursor(lastItem) : undefined,
  );

  const loadMore = useCallback(async () => {
    if (cursorRef.current === undefined) {
      return;
    }

    setIsLoading(true);

    try {
      const newItems = await fetchMore(cursorRef.current);

      if (newItems.length < limit) {
        setHasNextPage(false);
      }

      // Update cursor ref to the last new item
      const lastNewItem = newItems.at(-1);
      if (lastNewItem) {
        cursorRef.current = getCursor(lastNewItem);
      }

      setItems((prev) => {
        // Dedupe by key to prevent duplicates from race conditions
        const existingKeys = new Set(prev.map(getKey));
        const uniqueNewItems = newItems.filter(
          (item) => !existingKeys.has(getKey(item)),
        );

        return [...prev, ...uniqueNewItems];
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchMore, getCursor, getKey, limit]);

  const [sentryRef] = useInfiniteScroll({
    hasNextPage,
    loading: isLoading,
    onLoadMore: loadMore,
    rootMargin,
  });

  return {
    hasNextPage,
    isLoading,
    items,
    sentryRef,
  };
}
