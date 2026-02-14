"use client";

import { authClient } from "@zoonk/auth/client";
import { useCallback, useEffect, useRef, useState } from "react";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const MIN_USERNAME_LENGTH = 3;
const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;
const DEBOUNCE_MS = 300;

function getDescription(status: UsernameStatus, username: string) {
  if (status === "checking") {
    return "Checking...";
  }

  if (status === "available") {
    return `${username} is available`;
  }

  if (status === "taken") {
    return `${username} is already taken`;
  }

  if (status === "invalid") {
    return "3-30 characters. Letters, numbers, underscores, and hyphens only.";
  }

  return "3-30 characters. Letters, numbers, underscores, and hyphens only.";
}

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

      const { data } = await authClient.isUsernameAvailable({
        username: value,
      });

      setStatus(data?.available ? "available" : "taken");
    },
    [currentUsername],
  );

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!username || username.length < MIN_USERNAME_LENGTH) {
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
    description: getDescription(status, username),
    setUsername,
    status,
    username,
  };
}
