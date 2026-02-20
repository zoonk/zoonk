import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useClipboard } from "./use-clipboard";

describe(useClipboard, () => {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("copies text and resets after timeout", async () => {
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.isCopied).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCopied).toBeFalsy();
  });

  test("clears previous timer on rapid consecutive calls", async () => {
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("first");
    });

    expect(result.current.isCopied).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.copy("second");
    });

    expect(result.current.isCopied).toBeTruthy();

    // Original timer would have fired at 2000ms but was cleared
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isCopied).toBeTruthy();

    // New timer fires at 1500 + 2000 = 3500ms total
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.isCopied).toBeFalsy();
  });

  test("cleans up timer on unmount", async () => {
    const { result, unmount } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });

    expect(result.current.isCopied).toBeTruthy();

    unmount();

    // Timer should have been cleaned up, no state update error
    act(() => {
      vi.advanceTimersByTime(2000);
    });
  });
});
