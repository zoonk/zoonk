import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useInfiniteList } from "./use-infinite-list";

vi.mock("react-infinite-scroll-hook", () => ({
  default: () => [vi.fn()],
}));

type TestItem = {
  id: number;
  name: string;
};

const defaultProps = {
  fetchMore: vi.fn().mockResolvedValue([]),
  getCursor: (item: TestItem) => item.id,
  getKey: (item: TestItem) => item.id,
  limit: 10,
};

describe(useInfiniteList, () => {
  test("resets items when initialItems change", () => {
    const firstItems: TestItem[] = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ];

    const secondItems: TestItem[] = [
      { id: 3, name: "Item 3" },
      { id: 4, name: "Item 4" },
    ];

    const { result, rerender } = renderHook(
      ({ initialItems }: { initialItems: TestItem[] }) =>
        useInfiniteList({ ...defaultProps, initialItems }),
      { initialProps: { initialItems: firstItems } },
    );

    expect(result.current.items).toEqual(firstItems);

    rerender({ initialItems: secondItems });

    expect(result.current.items).toEqual(secondItems);
  });

  test("does not reset when the same items are passed with a new reference", () => {
    const items: TestItem[] = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ];

    const { result, rerender } = renderHook(
      ({ initialItems }: { initialItems: TestItem[] }) =>
        useInfiniteList({ ...defaultProps, initialItems }),
      { initialProps: { initialItems: items } },
    );

    expect(result.current.items).toEqual(items);

    // Pass a new array reference with the same items
    rerender({ initialItems: [...items] });

    expect(result.current.items).toEqual(items);
  });

  test("updates hasNextPage when new initialItems are below limit", () => {
    const fullPage: TestItem[] = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      name: `Item ${index + 1}`,
    }));

    const partialPage: TestItem[] = [{ id: 100, name: "Only item" }];

    const { result, rerender } = renderHook(
      ({ initialItems }: { initialItems: TestItem[] }) =>
        useInfiniteList({ ...defaultProps, initialItems }),
      { initialProps: { initialItems: fullPage } },
    );

    expect(result.current.hasNextPage).toBeTruthy();

    rerender({ initialItems: partialPage });

    expect(result.current.hasNextPage).toBeFalsy();
  });
});
