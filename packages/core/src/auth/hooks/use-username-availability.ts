"use client";

import { authClient } from "@zoonk/auth/client";
import { useCallback, useEffect, useRef, useState } from "react";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
const USERNAME_REGEX = /^[a-z0-9_.]{3,30}$/;
const DEBOUNCE_MS = 300;

export function useUsernameAvailability(currentUsername?: string | null) {
  const [username, setUsername] = useState(currentUsername ?? "");
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const checkAvailability = useCallback(
    async (value: string) => {
      if (!USERNAME_REGEX.test(value)) {
        setStatus("invalid");
        return;
      }

      if (value === currentUsername) {
        setStatus("idle");
        return;
      }

      setStatus("checking");

      const { data, error } = await authClient.isUsernameAvailable({
        username: value,
      });

      if (error) {
        setStatus("idle");
        return;
      }

      setStatus(data?.available ? "available" : "taken");
    },
    [currentUsername],
  );

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!username || username.length < USERNAME_MIN_LENGTH) {
      setStatus(username.length > 0 ? "invalid" : "idle");
      return;
    }

    timerRef.current = setTimeout(() => {
      void checkAvailability(username);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [username, checkAvailability]);

  return {
    setUsername,
    status,
    username,
  };
}
