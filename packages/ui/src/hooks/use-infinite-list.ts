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
  const loadInFlight = useRef(false);

  /**
   * Load-more requests are opportunistic background fetches. Network failures
   * should stop auto-loading instead of escaping as global promise rejections.
   */
  const loadMore = useCallback(async () => {
    const cursor = getLastKey(items, getKey);

    if (cursor === null || loadInFlight.current) {
      return;
    }

    loadInFlight.current = true;
    setIsLoading(true);

    const { data: newItems, error } = await safeAsync(() => fetchMore(cursor));
    loadInFlight.current = false;
    setIsLoading(false);

    if (error) {
      setHasLoadError(true);
      return;
    }

    setHasNextPage(newItems.length >= limit);

    setItems((prev) => {
      const existingKeys = new Set(prev.map((item) => getKey(item)));
      const uniqueNewItems = newItems.filter((item) => !existingKeys.has(getKey(item)));
      return [...prev, ...uniqueNewItems];
    });

    setHasLoadError(false);
  }, [fetchMore, getKey, items, limit]);

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
