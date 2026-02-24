// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnimatedProgress } from "./use-animated-progress";

describe(useAnimatedProgress, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns realProgress when not active", () => {
    const { result } = renderHook(() => useAnimatedProgress(42, false));
    expect(result.current).toBe(42);
  });

  it("returns realProgress initially when active", () => {
    const { result } = renderHook(() => useAnimatedProgress(10, true));
    expect(result.current).toBe(10);
  });

  it("drifts forward when active and stalled", () => {
    const { result } = renderHook(() => useAnimatedProgress(10, true));

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current).toBeGreaterThan(10);
  });

  it("never exceeds realProgress + MAX_DRIFT (8)", () => {
    const { result } = renderHook(() => useAnimatedProgress(10, true));

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(result.current).toBeLessThanOrEqual(18);
  });

  it("never exceeds CAP (97)", () => {
    const { result } = renderHook(() => useAnimatedProgress(90, true));

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(result.current).toBeLessThanOrEqual(97);
  });

  it("snaps to real progress when it updates", () => {
    const { result, rerender } = renderHook(
      ({ progress, active }) => useAnimatedProgress(progress, active),
      { initialProps: { active: true, progress: 10 } },
    );

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    const driftedValue = result.current;
    expect(driftedValue).toBeGreaterThan(10);

    rerender({ active: true, progress: 50 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBeGreaterThanOrEqual(50);
  });

  it("never decreases when realProgress drops", () => {
    const { result, rerender } = renderHook(
      ({ progress, active }) => useAnimatedProgress(progress, active),
      { initialProps: { active: true, progress: 10 } },
    );

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    const driftedValue = result.current;
    expect(driftedValue).toBeGreaterThan(10);

    rerender({ active: true, progress: 5 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBeGreaterThanOrEqual(driftedValue);
  });

  it("continues drifting when realProgress stays below high water mark", () => {
    const { result, rerender } = renderHook(
      ({ progress, active }) => useAnimatedProgress(progress, active),
      { initialProps: { active: true, progress: 20 } },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    const firstDrift = result.current;
    expect(firstDrift).toBeGreaterThan(20);

    rerender({ active: true, progress: 15 });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBeGreaterThanOrEqual(firstDrift);
  });

  it("stops drifting when active becomes false", () => {
    const { result, rerender } = renderHook(
      ({ progress, active }) => useAnimatedProgress(progress, active),
      { initialProps: { active: true, progress: 30 } },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    rerender({ active: false, progress: 30 });

    expect(result.current).toBe(30);
  });

  it("cleans up animation frame on unmount", () => {
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { unmount } = renderHook(() => useAnimatedProgress(10, true));

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
