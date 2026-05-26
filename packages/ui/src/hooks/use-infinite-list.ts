"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useRef, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";

/**
 * Infinite lists page from the last rendered item, so this keeps cursor
 * bookkeeping tied to the deduped list instead of the raw server response.
 */
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
  hasLoadError: boolean;
  isLoading: boolean;
  items: TItem[];
  retry: () => void;
  sentryRef: (node: Element | null) => void;
} {
  const [items, setItems] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(initialItems.length >= limit);
  const lastKeyRef = useRef(getLastKey(initialItems, getKey));

  /**
   * Load-more requests are opportunistic background fetches. Network failures
   * should stop auto-loading instead of escaping as global promise rejections.
   */
  const loadMore = useCallback(async () => {
    const cursor = lastKeyRef.current;

    if (cursor === null) {
      return;
    }

    setIsLoading(true);

    try {
      const { data: newItems, error } = await safeAsync(() => fetchMore(cursor));

      if (error) {
        setHasLoadError(true);
        return;
      }

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

      setHasLoadError(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchMore, getKey, limit]);

  /**
   * A failed background load should be user-recoverable without reloading the
   * page, but retrying only on intent prevents a visible sentinel from looping.
   */
  const retry = useCallback(() => {
    setHasLoadError(false);
    void loadMore();
  }, [loadMore]);

  const [sentryRef] = useInfiniteScroll({
    disabled: hasLoadError,
    hasNextPage,
    loading: isLoading,
    onLoadMore: loadMore,
    rootMargin,
  });

  return { hasLoadError, hasNextPage, isLoading, items, retry, sentryRef };
}
