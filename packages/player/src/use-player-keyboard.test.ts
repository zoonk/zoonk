// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type PlayerKeyboardModel } from "./player-screen";
import { usePlayerKeyboard } from "./use-player-keyboard";

function buildOptions(overrides: Partial<Parameters<typeof usePlayerKeyboard>[0]> = {}) {
  return {
    keyboard: {
      canRestart: false,
      enterAction: null,
      leftAction: null,
      rightAction: null,
    } as PlayerKeyboardModel,
    onCheck: vi.fn(),
    onContinue: vi.fn(),
    onEscape: vi.fn(),
    onNavigateNext: vi.fn(),
    onNavigatePrev: vi.fn(),
    onNext: null as (() => void) | null,
    onRestart: vi.fn(),
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
    test("calls onCheck when the screen model exposes a check action", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: "check",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onCheck).toHaveBeenCalledOnce();
    });

    test("calls onContinue when the screen model exposes a continue action", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: "continue",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onContinue).toHaveBeenCalledOnce();
    });

    test("no-op when Enter has no mapped action", () => {
      const opts = buildOptions();
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onCheck).not.toHaveBeenCalled();
      expect(opts.onContinue).not.toHaveBeenCalled();
    });

    test("calls onNext when completion Enter action prefers next", () => {
      const onNext = vi.fn();
      const opts = buildOptions({
        keyboard: {
          canRestart: true,
          enterAction: "nextOrEscape",
          leftAction: null,
          rightAction: null,
        },
        onNext,
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(onNext).toHaveBeenCalledOnce();
      expect(opts.onEscape).not.toHaveBeenCalled();
    });

    test("calls onEscape when completion Enter action has no next callback", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: true,
          enterAction: "nextOrEscape",
          leftAction: null,
          rightAction: null,
        },
        onNext: null,
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter");

      expect(opts.onEscape).toHaveBeenCalledOnce();
      expect(opts.onCheck).not.toHaveBeenCalled();
      expect(opts.onContinue).not.toHaveBeenCalled();
    });
  });

  describe("Navigation keys", () => {
    test("ArrowRight calls onNavigateNext when the screen model enables it", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: null,
          leftAction: null,
          rightAction: "navigateNext",
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowRight");

      expect(opts.onNavigateNext).toHaveBeenCalledOnce();
    });

    test("ArrowLeft calls onNavigatePrev when the screen model enables it", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: null,
          leftAction: "navigatePrev",
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowLeft");

      expect(opts.onNavigatePrev).toHaveBeenCalledOnce();
    });

    test("ArrowLeft no-ops when no previous action is mapped", () => {
      const opts = buildOptions();
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowLeft");

      expect(opts.onNavigatePrev).not.toHaveBeenCalled();
    });

    test("ArrowRight no-ops when no next action is mapped", () => {
      const opts = buildOptions();
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("ArrowRight");

      expect(opts.onNavigateNext).not.toHaveBeenCalled();
    });
  });

  describe("Escape key", () => {
    test("calls onEscape regardless of screen mode", () => {
      const opts = buildOptions();
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Escape");

      expect(opts.onEscape).toHaveBeenCalledOnce();
    });
  });

  describe("R key", () => {
    test("calls onRestart when restart is enabled", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: true,
          enterAction: "nextOrEscape",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("r");

      expect(opts.onRestart).toHaveBeenCalledOnce();
    });

    test("no-op when restart is disabled", () => {
      const opts = buildOptions();
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("r");

      expect(opts.onRestart).not.toHaveBeenCalled();
    });

    test("no-op when target is an input element", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: true,
          enterAction: "nextOrEscape",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      const input = document.createElement("input");
      document.body.append(input);
      const event = new KeyboardEvent("keydown", { bubbles: true, key: "r" });
      Object.defineProperty(event, "target", { value: input });
      globalThis.dispatchEvent(event);
      input.remove();

      expect(opts.onRestart).not.toHaveBeenCalled();
    });
  });

  describe("modifier keys", () => {
    test("all keys are no-op with metaKey", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: "check",
          leftAction: null,
          rightAction: "navigateNext",
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { metaKey: true });
      fireKey("ArrowRight", { metaKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
      expect(opts.onNavigateNext).not.toHaveBeenCalled();
    });

    test("all keys are no-op with ctrlKey", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: "check",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { ctrlKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
    });

    test("all keys are no-op with shiftKey", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: "check",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { shiftKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
    });

    test("all keys are no-op with altKey", () => {
      const opts = buildOptions({
        keyboard: {
          canRestart: false,
          enterAction: "check",
          leftAction: null,
          rightAction: null,
        },
      });
      renderHook(() => usePlayerKeyboard(opts));

      fireKey("Enter", { altKey: true });

      expect(opts.onCheck).not.toHaveBeenCalled();
    });
  });

  test("cleans up listener on unmount", () => {
    const opts = buildOptions({
      keyboard: {
        canRestart: false,
        enterAction: "check",
        leftAction: null,
        rightAction: null,
      },
    });
    const { unmount } = renderHook(() => usePlayerKeyboard(opts));

    unmount();

    fireKey("Enter");

    expect(opts.onCheck).not.toHaveBeenCalled();
  });
});
