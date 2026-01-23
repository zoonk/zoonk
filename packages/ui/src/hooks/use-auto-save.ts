"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "../components/sonner";
import { useDebounce } from "./use-debounce";
import type { SaveStatusType } from "../components/save-status";

const AUTO_SAVE_DEBOUNCE_MS = 500;
const SAVED_VISIBLE_DURATION_MS = 2500;
const FADE_DURATION_MS = 500;
const SAVING_STATUS_DELAY_MS = 500;

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

  const debouncedValue = useDebounce(value, debounceMs);
  const lastSavedValue = useRef(initialValue);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequestRef = useRef(0);

  useEffect(() => {
    if (debouncedValue === lastSavedValue.current) {
      return;
    }

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    const currentRequest = ++saveRequestRef.current;
    const valueToSave = debouncedValue;

    // Only show "saving" if the request takes longer than the delay
    const savingTimeout = setTimeout(() => {
      if (currentRequest === saveRequestRef.current) {
        setStatus("saving");
      }
    }, SAVING_STATUS_DELAY_MS);

    onSave(valueToSave)
      .then((result) => {
        clearTimeout(savingTimeout);

        // Ignore outdated save completions to prevent race conditions
        if (currentRequest !== saveRequestRef.current) {
          return;
        }

        if (result.error) {
          toast.error(result.error);
          setStatus("unsaved");
        } else {
          lastSavedValue.current = valueToSave;
          setStatus("saved");

          // Start fading after the visible duration
          statusTimeoutRef.current = setTimeout(() => {
            setStatus("fading");

            // Remove after fade completes
            statusTimeoutRef.current = setTimeout(() => {
              setStatus("idle");
              statusTimeoutRef.current = null;
            }, FADE_DURATION_MS);
          }, SAVED_VISIBLE_DURATION_MS);
        }
      })
      .catch((error: unknown) => {
        clearTimeout(savingTimeout);

        if (currentRequest !== saveRequestRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to save";
        toast.error(message);
        setStatus("unsaved");
      });
  }, [debouncedValue, onSave]);

  useEffect(
    () => () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    },
    [],
  );

  function handleSetValue(newValue: string) {
    setValue(newValue);
  }

  return {
    setValue: handleSetValue,
    status,
    value,
  };
}
