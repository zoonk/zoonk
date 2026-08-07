const DEFAULT_LOCAL_INBOX_URL = "http://127.0.0.1:3202/api/emails";

/**
 * Resolves the mailbox through its public service URL so Portless can choose an internal process port without disconnecting development email delivery.
 */
export function getLocalInboxUrl(): string {
  return process.env.MAILBOX_URL || DEFAULT_LOCAL_INBOX_URL;
}
