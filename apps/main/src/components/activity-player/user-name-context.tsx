"use client";

import { authClient } from "@zoonk/core/auth/client";
import { STORAGE_KEY_DISPLAY_NAME } from "@zoonk/utils/constants";
import { replaceNamePlaceholder } from "@zoonk/utils/string";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

const UserNameContext = createContext<string | null>(null);

function subscribe(callback: () => void): () => void {
  globalThis.addEventListener("storage", callback);
  return () => globalThis.removeEventListener("storage", callback);
}

function getSnapshot(): string | null {
  return localStorage.getItem(STORAGE_KEY_DISPLAY_NAME);
}

function getServerSnapshot(): null {
  return null;
}

export function UserNameProvider({ children }: { children: React.ReactNode }) {
  const { data } = authClient.useSession();
  const sessionName = data?.user.name ?? null;
  const cachedName = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (sessionName) {
      localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, sessionName);
    }
  }, [sessionName]);

  const name = sessionName ?? cachedName;

  return <UserNameContext value={name}>{children}</UserNameContext>;
}

export function useReplaceName(): (text: string) => string {
  const name = useContext(UserNameContext);
  return useCallback((text: string) => replaceNamePlaceholder(text, name), [name]);
}
