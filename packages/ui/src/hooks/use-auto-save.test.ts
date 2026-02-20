import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAutoSave } from "./use-auto-save";

describe(useAutoSave, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resets value when initialValue changes", () => {
    const onSave = vi.fn().mockResolvedValue({ error: null });

    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) => useAutoSave({ initialValue, onSave }),
      { initialProps: { initialValue: "original" } },
    );

    expect(result.current.value).toBe("original");

    rerender({ initialValue: "updated from server" });

    expect(result.current.value).toBe("updated from server");
  });

  test("does not trigger save when initialValue changes", () => {
    const onSave = vi.fn().mockResolvedValue({ error: null });

    const { rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) => useAutoSave({ initialValue, onSave }),
      { initialProps: { initialValue: "original" } },
    );

    rerender({ initialValue: "updated from server" });

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should not save because lastSavedValue was also updated
    expect(onSave).not.toHaveBeenCalled();
  });

  test("saves after user edits following an initialValue change", async () => {
    const onSave = vi.fn().mockResolvedValue({ error: null });

    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) => useAutoSave({ initialValue, onSave }),
      { initialProps: { initialValue: "original" } },
    );

    rerender({ initialValue: "updated from server" });

    act(() => {
      result.current.setValue("user edit");
    });

    // Advance past debounce (default 500ms)
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(onSave).toHaveBeenCalledWith("user edit");
  });
});
