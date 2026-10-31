const DEFAULT_LOCAL_INBOX_URL = "http://127.0.0.1:3202/api/emails";

export function getLocalInboxUrl(): string {
  return process.env.MAILBOX_URL || DEFAULT_LOCAL_INBOX_URL;
}
