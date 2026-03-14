// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCountingGenerator, useThinkingMessages } from "./use-thinking-messages";

const cyclingGenerators = {
  phaseA: (index: number) => ["Analyzing...", "Planning...", "Building..."][index % 3] ?? "",
  phaseB: (index: number) => ["Loading...", "Processing..."][index % 2] ?? "",
};

const countingGenerators = {
  chapters: createCountingGenerator({
    intro: ["Planning..."],
    itemTemplate: (num) => `Chapter ${num}`,
    reviewMessage: "Reviewing...",
  }),
  lessons: createCountingGenerator({
    intro: ["Exploring..."],
    itemTemplate: (num) => `Lesson ${num}`,
    reviewMessage: "Reviewing...",
  }),
};

function advanceTicks(count: number) {
  Array.from({ length: count }).forEach(() => {
    act(() => {
      vi.advanceTimersByTime(3000);
    });
  });
}

describe(useThinkingMessages, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty object when no phases are active", () => {
    const { result } = renderHook(() => useThinkingMessages(cyclingGenerators, []));
    expect(result.current).toEqual({});
  });

  it("returns first message immediately for active phases", () => {
    const { result } = renderHook(() => useThinkingMessages(cyclingGenerators, ["phaseA"]));
    expect(result.current).toEqual({ phaseA: "Analyzing..." });
  });

  it("returns messages for multiple active phases simultaneously", () => {
    const { result } = renderHook(() =>
      useThinkingMessages(cyclingGenerators, ["phaseA", "phaseB"]),
    );
    expect(result.current).toEqual({ phaseA: "Analyzing...", phaseB: "Loading..." });
  });

  it("cycles through messages over time", () => {
    const { result } = renderHook(() =>
      useThinkingMessages(cyclingGenerators, ["phaseA", "phaseB"]),
    );

    expect(result.current).toEqual({ phaseA: "Analyzing...", phaseB: "Loading..." });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toEqual({ phaseA: "Planning...", phaseB: "Processing..." });
  });

  it("uses randomized intervals between 1.5-3s", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const { result } = renderHook(() => useThinkingMessages(cyclingGenerators, ["phaseA"]));

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
      ({ active }) => useThinkingMessages(cyclingGenerators, active),
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

  it("starts lesson numbering at 1 when switching from chapters phase", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useThinkingMessages(countingGenerators, active),
      { initialProps: { active: ["chapters"] as string[] } },
    );

    expect(result.current).toEqual({ chapters: "Planning..." });

    advanceTicks(5);

    expect(result.current.chapters).toMatch(/Chapter \d+/);

    rerender({ active: ["lessons"] });

    expect(result.current).toEqual({ lessons: "Exploring..." });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toEqual({ lessons: "Lesson 1" });
  });
});
