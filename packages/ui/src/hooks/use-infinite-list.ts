"use client";

import { useCallback, useRef, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";

export function useInfiniteList<TItem>({
  fetchMore,
  getKey,
  initialItems,
  limit,
  rootMargin = "0px 0px 200px 0px",
}: {
  initialItems: TItem[];
  limit: number;
  fetchMore: (offset: number) => Promise<TItem[]>;
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
  const offsetRef = useRef(initialItems.length);

  const loadMore = useCallback(async () => {
    setIsLoading(true);

    try {
      const newItems = await fetchMore(offsetRef.current);

      if (newItems.length < limit) {
        setHasNextPage(false);
      }

      setItems((prev) => {
        // Dedupe by key to prevent duplicates from race conditions
        const existingKeys = new Set(prev.map((item) => getKey(item)));
        const uniqueNewItems = newItems.filter((item) => !existingKeys.has(getKey(item)));

        offsetRef.current = prev.length + uniqueNewItems.length;

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
