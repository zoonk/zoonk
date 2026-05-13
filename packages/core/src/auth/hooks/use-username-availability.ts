"use client";

import { authClient } from "@zoonk/auth/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { USERNAME_MIN_LENGTH, isUsernameSyntaxValid, normalizeUsername } from "../username-rules";

export type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const DEBOUNCE_MS = 300;

/**
 * Keeps profile/setup username fields on the same normalized syntax policy as
 * the server while still asking Better Auth for reserved-name and duplicate
 * checks. That split lets the client reject impossible URL shapes immediately
 * without bundling the full reserved username blocklist.
 */
export function useUsernameAvailability(currentUsername?: string | null) {
  const normalizedCurrentUsername = currentUsername ? normalizeUsername(currentUsername) : "";
  const [username, setUsername] = useState(normalizedCurrentUsername);
  const [status, setStatus] = useState<UsernameStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);

  // Render-time state adjustment: sync username when currentUsername
  // arrives from async session without an extra render pass.
  const [prevCurrentUsername, setPrevCurrentUsername] = useState(currentUsername);

  if (currentUsername !== prevCurrentUsername) {
    setPrevCurrentUsername(currentUsername);

    if (currentUsername) {
      setUsername(normalizedCurrentUsername);
    }
  }

  const setNormalizedUsername = useCallback((value: string) => {
    setUsername(normalizeUsername(value));
  }, []);

  const checkAvailability = useCallback(
    async (value: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!isUsernameSyntaxValid(value)) {
        setStatus("invalid");
        return;
      }

      if (value === normalizedCurrentUsername) {
        setStatus("idle");
        return;
      }

      setStatus("checking");

      try {
        const { data, error } = await authClient.isUsernameAvailable({
          fetchOptions: { signal: controller.signal },
          username: value,
        });

        if (error) {
          setStatus("taken");
          return;
        }

        setStatus(data?.available ? "available" : "taken");
      } catch {
        // When abort() is called, better-fetch throws an AbortError
        // instead of returning { error }. Silently ignore it — the
        // newer request will handle the result.
        if (controller.signal.aborted) {
          return;
        }

        setStatus("idle");
      }
    },
    [normalizedCurrentUsername],
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

  return { setUsername: setNormalizedUsername, status, username };
}
