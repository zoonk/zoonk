"use client";

import type { SaveStatusType } from "@zoonk/ui/components/save-status";
import { toast } from "@zoonk/ui/components/sonner";
import { useDebounce } from "@zoonk/ui/hooks/debounce";
import { useEffect, useRef, useState, useTransition } from "react";

const AUTO_SAVE_DEBOUNCE_MS = 500;
const SAVED_STATUS_DURATION_MS = 2000;

export function useAutoSave({
  initialValue,
  onSave,
  debounceMs = AUTO_SAVE_DEBOUNCE_MS,
}: {
  initialValue: string;
  onSave: (value: string) => Promise<{ error: string | null }>;
  debounceMs?: number;
}): {
  status: SaveStatusType;
  value: string;
  setValue: (value: string) => void;
} {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<SaveStatusType>("idle");
  const [isPending, startTransition] = useTransition();

  const debouncedValue = useDebounce(value, debounceMs);
  const lastSavedValue = useRef(initialValue);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debouncedValue === lastSavedValue.current) {
      return;
    }

    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }

    startTransition(async () => {
      setStatus("saving");
      const result = await onSave(debouncedValue);

      if (result.error) {
        toast.error(result.error);
        setStatus("unsaved");
      } else {
        lastSavedValue.current = debouncedValue;
        setStatus("saved");

        savedTimeoutRef.current = setTimeout(() => {
          setStatus("idle");
          savedTimeoutRef.current = null;
        }, SAVED_STATUS_DURATION_MS);
      }
    });
  }, [debouncedValue, onSave]);

  useEffect(
    () => () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    },
    [],
  );

  function handleSetValue(newValue: string) {
    setValue(newValue);
    if (newValue !== lastSavedValue.current && status !== "unsaved") {
      setStatus("unsaved");
    }
  }

  return {
    setValue: handleSetValue,
    status: isPending ? "saving" : status,
    value,
  };
}
