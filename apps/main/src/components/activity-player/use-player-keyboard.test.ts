// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type PlayerPhase } from "./player-reducer";
import { usePlayerKeyboard } from "./use-player-keyboard";

function buildOptions(overrides: Partial<Parameters<typeof usePlayerKeyboard>[0]> = {}) {
  return {
    hasAnswer: false,
    isStaticStep: false,
    onCheck: vi.fn(),
    onContinue: vi.fn(),
    onEscape: vi.fn(),
    onNavigateNext: vi.fn(),
    onNavigatePrev: vi.fn(),
    phase: "playing" as PlayerPhase,
    ...overrides,
  };
}

function fireKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", { bubbles: true, key, ...modifiers });
  globalThis.dispatchEvent(event);
}

describe(usePlayerKeyboard, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Enter key", () => {
    test("calls onCheck when playing and hasAnswer", () => {
      const opts = buildOptions({ hasAnswer: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onCheck).toHaveBeenCalledOnce();
    });

    test("calls onContinue when feedback", () => {
      const opts = buildOptions({ phase: "feedback" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onContinue).toHaveBeenCalledOnce();
    });

    test("no-op when playing and no answer", () => {
      const opts = buildOptions({ hasAnswer: false, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onCheck).not.toHaveBeenCalled();
      expect(opts.onContinue).not.toHaveBeenCalled();
    });

    test("no-op when completed", () => {
      const opts = buildOptions({ phase: "completed" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onCheck).not.toHaveBeenCalled();
      expect(opts.onContinue).not.toHaveBeenCalled();
    });
  });

  describe("Arrow keys", () => {
    test("ArrowRight calls onNavigateNext when playing and static step", () => {
      const opts = buildOptions({ isStaticStep: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowRight");

      expect(opts.onNavigateNext).toHaveBeenCalledOnce();
    });

    test("ArrowLeft calls onNavigatePrev when playing and static step", () => {
      const opts = buildOptions({ isStaticStep: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowLeft");

      expect(opts.onNavigatePrev).toHaveBeenCalledOnce();
    });

    test("no-op for non-static steps", () => {
      const opts = buildOptions({ isStaticStep: false, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowRight");
      fireKey("ArrowLeft");

      expect(opts.onNavigateNext).not.toHaveBeenCalled();
      expect(opts.onNavigatePrev).not.toHaveBeenCalled();
    });

    test("no-op during feedback", () => {
      const opts = buildOptions({ isStaticStep: true, phase: "feedback" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowRight");
      fireKey("ArrowLeft");

      expect(opts.onNavigateNext).not.toHaveBeenCalled();
      expect(opts.onNavigatePrev).not.toHaveBeenCalled();
    });
  });

  describe("Escape key", () => {
    test("calls onEscape during playing phase", () => {
      const opts = buildOptions({ phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Escape");

      expect(opts.onEscape).toHaveBeenCalledOnce();
    });

    test("calls onEscape during feedback phase", () => {
      const opts = buildOptions({ phase: "feedback" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Escape");

      expect(opts.onEscape).toHaveBeenCalledOnce();
    });
  });

  describe("modifier keys", () => {
    test("all keys are no-op with metaKey", () => {
      const opts = buildOptions({ hasAnswer: true, isStaticStep: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { metaKey: true });
      fireKey("ArrowRight", { metaKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
      expect(opts.onNavigateNext).not.toHaveBeenCalled();
    });

    test("all keys are no-op with ctrlKey", () => {
      const opts = buildOptions({ hasAnswer: true, isStaticStep: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { ctrlKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
    });

    test("all keys are no-op with shiftKey", () => {
      const opts = buildOptions({ hasAnswer: true, isStaticStep: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { shiftKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
    });

    test("all keys are no-op with altKey", () => {
      const opts = buildOptions({ hasAnswer: true, isStaticStep: true, phase: "playing" });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { altKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
    });
  });

  test("cleans up listener on unmount", () => {
    const opts = buildOptions({ hasAnswer: true, phase: "playing" });
    const { unmount } = renderHook(() => usePlayerKeyboard(opts));

    unmount();

    fireKey("Enter");

    expect(opts.onCheck).not.toHaveBeenCalled();
  });
});
