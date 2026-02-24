// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThinkingMessages } from "./use-thinking-messages";

const generators = {
  phaseA: (index: number) => ["Analyzing...", "Planning...", "Building..."][index % 3] ?? "",
  phaseB: (index: number) => ["Loading...", "Processing..."][index % 2] ?? "",
};

describe(useThinkingMessages, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty object when no phases are active", () => {
    const { result } = renderHook(() => useThinkingMessages(generators, []));
    expect(result.current).toEqual({});
  });

  it("returns first message immediately for active phases", () => {
    const { result } = renderHook(() => useThinkingMessages(generators, ["phaseA"]));
    expect(result.current).toEqual({ phaseA: "Analyzing..." });
  });

  it("returns messages for multiple active phases simultaneously", () => {
    const { result } = renderHook(() => useThinkingMessages(generators, ["phaseA", "phaseB"]));
    expect(result.current).toEqual({ phaseA: "Analyzing...", phaseB: "Loading..." });
  });

  it("cycles through messages over time", () => {
    const { result } = renderHook(() => useThinkingMessages(generators, ["phaseA", "phaseB"]));

    expect(result.current).toEqual({ phaseA: "Analyzing...", phaseB: "Loading..." });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toEqual({ phaseA: "Planning...", phaseB: "Processing..." });
  });

  it("uses randomized intervals between 1.5-3s", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { result } = renderHook(() => useThinkingMessages(generators, ["phaseA"]));

    expect(result.current).toEqual({ phaseA: "Analyzing..." });

    act(() => {
      vi.advanceTimersByTime(1499);
    });

    expect(result.current).toEqual({ phaseA: "Analyzing..." });

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toEqual({ phaseA: "Planning..." });

    vi.spyOn(Math, "random").mockRestore();
  });

  it("resets index when becoming inactive", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useThinkingMessages(generators, active),
      { initialProps: { active: ["phaseA"] as string[] } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toEqual({ phaseA: "Planning..." });

    rerender({ active: [] });
    expect(result.current).toEqual({});

    rerender({ active: ["phaseA"] });
    expect(result.current).toEqual({ phaseA: "Analyzing..." });
  });
});
