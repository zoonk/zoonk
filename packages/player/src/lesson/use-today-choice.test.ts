import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isChosenToday, setChosenToday } from "./use-today-choice";

describe("today choices with readable storage", () => {
  const KEY = "today-choice-test";
  const TODAY = "2026-10-26";
  const stored = new Map<string, string>();

  const storage = {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    removeItem: vi.fn((key: string) => stored.delete(key)),
    setItem: vi.fn((key: string, value: string) => stored.set(key, value)),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 12));
    vi.stubGlobal("localStorage", storage);
    vi.clearAllMocks();
    stored.clear();
    setChosenToday(KEY, false);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps a choice in this tab when storing it is rejected", () => {
    // Storage can allow reads while rejecting writes, such as when its quota is exhausted.
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("Storage write denied");
    });

    setChosenToday(KEY, true);

    expect(storage.getItem(KEY)).toBeNull();
    expect(isChosenToday(KEY)).toBe(true);
  });

  it("keeps a cleared choice in this tab when removal is rejected", () => {
    stored.set(KEY, TODAY);
    expect(isChosenToday(KEY)).toBe(true);

    storage.removeItem.mockImplementationOnce(() => {
      throw new Error("Storage removal denied");
    });

    setChosenToday(KEY, false);

    expect(storage.getItem(KEY)).toBe(TODAY);
    expect(isChosenToday(KEY)).toBe(false);
  });

  it("persists successful choices and continues reading storage after recovery", () => {
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("Storage write denied");
    });

    setChosenToday(KEY, true);
    setChosenToday(KEY, true);

    expect(storage.getItem(KEY)).toBe(TODAY);
    expect(isChosenToday(KEY)).toBe(true);

    stored.delete(KEY);
    expect(isChosenToday(KEY)).toBe(false);

    setChosenToday(KEY, true);
    setChosenToday(KEY, false);
    expect(storage.getItem(KEY)).toBeNull();
    expect(isChosenToday(KEY)).toBe(false);

    stored.set(KEY, TODAY);
    expect(isChosenToday(KEY)).toBe(true);
  });
});
