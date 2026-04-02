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
    const { result } = renderHook(() =>
      useAnimatedProgress({ isActive: false, realProgress: 42, targetProgress: 42 }),
    );

    expect(result.current).toBe(42);
  });

  it("returns realProgress initially when active", () => {
    const { result } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 10, targetProgress: 50 }),
    );

    expect(result.current).toBe(10);
  });

  it("drifts forward when active and stalled", () => {
    const { result } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 10, targetProgress: 50 }),
    );

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current).toBeGreaterThan(10);
  });

  it("drifts proportionally to the gap between real and target", () => {
    // Small gap (target 15, real 10) — drift should be modest
    const { result: small } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 10, targetProgress: 15 }),
    );

    // Large gap (target 90, real 10) — drift should be much larger
    const { result: large } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 10, targetProgress: 90 }),
    );

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(large.current).toBeGreaterThan(small.current);
  });

  it("never exceeds targetProgress", () => {
    const { result } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 10, targetProgress: 30 }),
    );

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(result.current).toBeLessThanOrEqual(30);
  });

  it("never exceeds CAP (97)", () => {
    const { result } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 90, targetProgress: 100 }),
    );

    act(() => {
      vi.advanceTimersByTime(300_000);
    });

    expect(result.current).toBeLessThanOrEqual(97);
  });

  it("snaps to real progress when it updates", () => {
    const { result, rerender } = renderHook((props) => useAnimatedProgress(props), {
      initialProps: { isActive: true, realProgress: 10, targetProgress: 30 },
    });

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    const driftedValue = result.current;
    expect(driftedValue).toBeGreaterThan(10);

    rerender({ isActive: true, realProgress: 50, targetProgress: 80 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBeGreaterThanOrEqual(50);
  });

  it("never decreases when realProgress drops", () => {
    const { result, rerender } = renderHook((props) => useAnimatedProgress(props), {
      initialProps: { isActive: true, realProgress: 10, targetProgress: 50 },
    });

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    const driftedValue = result.current;
    expect(driftedValue).toBeGreaterThan(10);

    rerender({ isActive: true, realProgress: 5, targetProgress: 50 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBeGreaterThanOrEqual(driftedValue);
  });

  it("continues drifting when realProgress stays below high water mark", () => {
    const { result, rerender } = renderHook((props) => useAnimatedProgress(props), {
      initialProps: { isActive: true, realProgress: 20, targetProgress: 60 },
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    const firstDrift = result.current;
    expect(firstDrift).toBeGreaterThan(20);

    rerender({ isActive: true, realProgress: 15, targetProgress: 60 });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBeGreaterThanOrEqual(firstDrift);
  });

  it("stops drifting when active becomes false", () => {
    const { result, rerender } = renderHook((props) => useAnimatedProgress(props), {
      initialProps: { isActive: true, realProgress: 30, targetProgress: 70 },
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    rerender({ isActive: false, realProgress: 30, targetProgress: 70 });

    expect(result.current).toBe(30);
  });

  it("does not drift when target equals real progress", () => {
    const { result } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 50, targetProgress: 50 }),
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current).toBe(50);
  });

  it("cleans up animation frame on unmount", () => {
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { unmount } = renderHook(() =>
      useAnimatedProgress({ isActive: true, realProgress: 10, targetProgress: 50 }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
