import { useSyncExternalStore } from "react";
import { type EmailInboxResponse, isEmailInboxResponse } from "./email";

type EmailStoreSnapshot = EmailInboxResponse & { status: "loading" | "ready" | "unavailable" };

const EMAILS_PATH = "/api/emails";
const POLLING_INTERVAL = 1000;
const listeners = new Set<() => void>();
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let snapshot: EmailStoreSnapshot = { emails: [], status: "loading" };

export function useEmailInbox(): EmailStoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export async function clearEmailInbox(): Promise<void> {
  await fetch(EMAILS_PATH, { method: "DELETE" });
  await refreshEmailInbox();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    void refreshEmailInbox();
    pollingTimer = globalThis.setInterval(() => void refreshEmailInbox(), POLLING_INTERVAL);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && pollingTimer !== null) {
      globalThis.clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };
}

function getSnapshot(): EmailStoreSnapshot {
  return snapshot;
}

async function refreshEmailInbox(): Promise<void> {
  try {
    const response = await fetch(EMAILS_PATH);

    if (!response.ok) {
      throw new Error(`Inbox request failed: ${response.statusText}`);
    }

    const data: unknown = await response.json();

    if (!isEmailInboxResponse(data)) {
      throw new Error("Inbox returned an invalid response.");
    }

    snapshot = { emails: data.emails, status: "ready" };
  } catch {
    snapshot = { emails: snapshot.emails, status: "unavailable" };
  }

  listeners.forEach((listener) => listener());
}
