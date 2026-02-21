// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useOptionKeyboard } from "./use-option-keyboard";

function buildOptions(overrides: Partial<Parameters<typeof useOptionKeyboard>[0]> = {}) {
  return {
    enabled: true,
    onSelect: vi.fn(),
    optionCount: 4,
    ...overrides,
  };
}

function fireKey(key: string, modifiers: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", { bubbles: true, key, ...modifiers });
  globalThis.dispatchEvent(event);
}

describe(useOptionKeyboard, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("key 1 calls onSelect with index 0", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("1");

    expect(opts.onSelect).toHaveBeenCalledWith(0);
  });

  test("key 2 calls onSelect with index 1", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("2");

    expect(opts.onSelect).toHaveBeenCalledWith(1);
  });

  test("key 4 calls onSelect with index 3", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("4");

    expect(opts.onSelect).toHaveBeenCalledWith(3);
  });

  test("key beyond option count is ignored", () => {
    const opts = buildOptions({ optionCount: 3 });
    renderHook(() => useOptionKeyboard(opts));

    fireKey("4");

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("key 0 is ignored", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("0");

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("non-digit keys are ignored", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("a");
    fireKey("Enter");
    fireKey("ArrowRight");

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("key with metaKey modifier is ignored", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("1", { metaKey: true });

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("key with ctrlKey modifier is ignored", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("1", { ctrlKey: true });

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("key with shiftKey modifier is ignored", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("1", { shiftKey: true });

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("key with altKey modifier is ignored", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    fireKey("1", { altKey: true });

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("disabled state prevents selection", () => {
    const opts = buildOptions({ enabled: false });
    renderHook(() => useOptionKeyboard(opts));

    fireKey("1");

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("ignores keys when focus is on input element", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    const input = document.createElement("input");
    document.body.append(input);
    const event = new KeyboardEvent("keydown", { bubbles: true, key: "1" });
    Object.defineProperty(event, "target", { value: input });
    globalThis.dispatchEvent(event);
    input.remove();

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("ignores keys when focus is on textarea element", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    const event = new KeyboardEvent("keydown", { bubbles: true, key: "1" });
    Object.defineProperty(event, "target", { value: textarea });
    globalThis.dispatchEvent(event);
    textarea.remove();

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("ignores keys when focus is on contenteditable element", () => {
    const opts = buildOptions();
    renderHook(() => useOptionKeyboard(opts));

    const div = document.createElement("div");
    Object.defineProperty(div, "isContentEditable", { value: true });
    document.body.append(div);
    const event = new KeyboardEvent("keydown", { bubbles: true, key: "1" });
    Object.defineProperty(event, "target", { value: div });
    globalThis.dispatchEvent(event);
    div.remove();

    expect(opts.onSelect).not.toHaveBeenCalled();
  });

  test("cleans up listener on unmount", () => {
    const opts = buildOptions();
    const { unmount } = renderHook(() => useOptionKeyboard(opts));

    unmount();

    fireKey("1");

    expect(opts.onSelect).not.toHaveBeenCalled();
  });
});
