"use client";

import { useCallback, useRef, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";

function getLastKey<TItem>(
  items: TItem[],
  getKey: (item: TItem) => string | number,
): string | number | null {
  const lastItem = items.at(-1);
  return lastItem ? getKey(lastItem) : null;
}

export function useInfiniteList<TItem>({
  fetchMore,
  getKey,
  initialItems,
  limit,
  rootMargin = "0px 0px 200px 0px",
}: {
  initialItems: TItem[];
  limit: number;
  fetchMore: (cursor: string | number) => Promise<TItem[]>;
  getKey: (item: TItem) => string | number;
  rootMargin?: string;
}): {
  hasNextPage: boolean;
  isLoading: boolean;
  items: TItem[];
  sentryRef: (node: Element | null) => void;
} {
  const [items, setItems] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(initialItems.length >= limit);
  const lastKeyRef = useRef(getLastKey(initialItems, getKey));

  const loadMore = useCallback(async () => {
    if (lastKeyRef.current === null) {
      return;
    }

    setIsLoading(true);

    try {
      const newItems = await fetchMore(lastKeyRef.current);

      if (newItems.length < limit) {
        setHasNextPage(false);
      }

      setItems((prev) => {
        // Dedupe by key to prevent duplicates from race conditions
        const existingKeys = new Set(prev.map((item) => getKey(item)));
        const uniqueNewItems = newItems.filter((item) => !existingKeys.has(getKey(item)));

        const newLastKey = getLastKey(uniqueNewItems, getKey);

        if (newLastKey !== null) {
          lastKeyRef.current = newLastKey;
        }

        return [...prev, ...uniqueNewItems];
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchMore, getKey, limit]);

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
