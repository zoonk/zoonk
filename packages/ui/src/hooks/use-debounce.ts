import { useEffect, useState } from "react";

const DEBOUNCE_MS = 300;

/**
 * Returns a debounced version of the provided value.
 * The debounced value only updates after the specified delay
 * has passed without the value changing.
 */
export function useDebounce<T>(value: T, delay: number = DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
