import { useSyncExternalStore } from "react";
import { type EmailInboxResponse, isEmailInboxResponse } from "./email";

export type EmailInboxStatus = "loading" | "ready" | "unavailable";

type EmailStoreSnapshot = EmailInboxResponse & { status: EmailInboxStatus };

const EMAILS_PATH = "/api/emails";
const POLLING_INTERVAL = 1000;
const MAX_POLLING_INTERVAL = 30_000;
const listeners = new Set<() => void>();
let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isChecking = false;
let failedChecks = 0;
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
    document.addEventListener("visibilitychange", checkNow);
    void poll();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", checkNow);
      stopPolling();
    }
  };
}

function checkNow(): void {
  failedChecks = 0;
  void poll();
}

function stopPolling(): void {
  if (pollingTimer !== null) {
    globalThis.clearTimeout(pollingTimer);
    pollingTimer = null;
  }
}

/**
 * Checks only while the tab is visible, and waits longer after each failed check, so a tab left
 * open on a stopped mailbox doesn't fill the shared proxy's log with an error every second.
 */
async function poll(): Promise<void> {
  stopPolling();

  if (document.hidden || isChecking) {
    return;
  }

  isChecking = true;
  await refreshEmailInbox();
  isChecking = false;

  if (listeners.size > 0 && !document.hidden) {
    const delay = Math.min(POLLING_INTERVAL * 2 ** failedChecks, MAX_POLLING_INTERVAL);
    pollingTimer = globalThis.setTimeout(() => void poll(), delay);
  }
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
    failedChecks = 0;
  } catch {
    snapshot = { emails: snapshot.emails, status: "unavailable" };
    failedChecks += 1;
  }

  listeners.forEach((listener) => listener());
}
