import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoSave } from "./use-auto-save";

describe(useAutoSave, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets value when initialValue changes", () => {
    const onSave = vi.fn().mockResolvedValue({ error: null });

    const { result, rerender } = renderHook(
      ({ initialValue }: { initialValue: string }) => useAutoSave({ initialValue, onSave }),
      { initialProps: { initialValue: "original" } },
    );

    expect(result.current.value).toBe("original");

    rerender({ initialValue: "updated from server" });

    expect(result.current.value).toBe("updated from server");
  });

  it("does not trigger save when initialValue changes", () => {
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

  it("saves after user edits following an initialValue change", async () => {
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

  it("does not start a duplicate save when the callback changes during a pending request", async () => {
    const firstOnSave = vi.fn().mockReturnValue(new Promise(() => {}));
    const nextOnSave = vi.fn().mockResolvedValue({ error: null });

    const { result, rerender } = renderHook(
      ({ onSave }: { onSave: (value: string) => Promise<{ error: string | null }> }) =>
        useAutoSave({ initialValue: "original", onSave }),
      { initialProps: { onSave: firstOnSave } },
    );

    act(() => {
      result.current.setValue("user edit");
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(firstOnSave).toHaveBeenCalledOnce();

    rerender({ onSave: nextOnSave });

    expect(nextOnSave).not.toHaveBeenCalled();
  });
});
