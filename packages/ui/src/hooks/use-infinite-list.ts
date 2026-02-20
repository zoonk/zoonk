"use client";

import { useCallback, useRef, useState } from "react";
import useInfiniteScroll from "react-infinite-scroll-hook";

function getItemsIdentity<TItem>(items: TItem[], getKey: (item: TItem) => string | number): string {
  return items.map((item) => getKey(item)).join(",");
}

export function useInfiniteList<TItem, TCursor>({
  fetchMore,
  getCursor,
  getKey,
  initialItems,
  limit,
  rootMargin = "0px 0px 200px 0px",
}: {
  initialItems: TItem[];
  limit: number;
  getCursor: (item: TItem) => TCursor;
  fetchMore: (cursor: TCursor) => Promise<TItem[]>;
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

  // Use ref to track the latest cursor to avoid stale closures
  const lastItem = initialItems.at(-1);
  const cursorRef = useRef<TCursor | undefined>(lastItem ? getCursor(lastItem) : undefined);

  const itemsIdentity = getItemsIdentity(initialItems, getKey);
  const [prevIdentity, setPrevIdentity] = useState(itemsIdentity);

  if (itemsIdentity !== prevIdentity) {
    setPrevIdentity(itemsIdentity);
    setItems(initialItems);
    setHasNextPage(initialItems.length >= limit);
    const lastInitialItem = initialItems.at(-1);
    cursorRef.current = lastInitialItem ? getCursor(lastInitialItem) : undefined;
  }

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
        const existingKeys = new Set(prev.map((item) => getKey(item)));
        const uniqueNewItems = newItems.filter((item) => !existingKeys.has(getKey(item)));

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
