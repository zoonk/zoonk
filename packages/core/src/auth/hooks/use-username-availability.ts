"use client";

import { isUsernameSyntaxValid, normalizeUsername } from "@zoonk/auth/username-rules";
import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useEffect, useState } from "react";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const DEBOUNCE_MS = 300;

export function useUsernameAvailability(currentUsername?: string | null) {
  const normalizedCurrentUsername = currentUsername ? normalizeUsername(currentUsername) : "";
  const [username, setUsername] = useState(normalizedCurrentUsername);

  const [availability, setAvailability] = useState<{
    username: string;
    status: UsernameStatus;
  } | null>(null);

  const [prevCurrentUsername, setPrevCurrentUsername] = useState(currentUsername);

  if (currentUsername !== prevCurrentUsername) {
    setPrevCurrentUsername(currentUsername);

    if (currentUsername) {
      setUsername(normalizedCurrentUsername);
    }
  }

  const setNormalizedUsername = useCallback(
    (value: string) => {
      const normalized = normalizeUsername(value);

      if (normalized === username) {
        return;
      }

      setUsername(normalized);
      setAvailability(null);
    },
    [username],
  );

  useEffect(() => {
    if (!isUsernameSyntaxValid(username) || username === normalizedCurrentUsername) {
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      const { data: response, error } = await safeAsync(async () => {
        const { authClient } = await import("@zoonk/auth/client");

        return authClient.isUsernameAvailable({
          fetchOptions: { signal: controller.signal },
          username,
        });
      });

      if (controller.signal.aborted) {
        return;
      }

      if (error) {
        setAvailability({ status: "idle", username });
        return;
      }

      const available = !response.error && response.data?.available;
      setAvailability({ status: available ? "available" : "taken", username });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [username, normalizedCurrentUsername]);

  const status = getUsernameStatus({ availability, normalizedCurrentUsername, username });

  return { setUsername: setNormalizedUsername, status, username };
}

function getUsernameStatus({
  availability,
  normalizedCurrentUsername,
  username,
}: {
  availability: { username: string; status: UsernameStatus } | null;
  normalizedCurrentUsername: string;
  username: string;
}): UsernameStatus {
  if (!username || username === normalizedCurrentUsername) {
    return "idle";
  }

  if (!isUsernameSyntaxValid(username)) {
    return "invalid";
  }

  return availability?.username === username ? availability.status : "checking";
}
