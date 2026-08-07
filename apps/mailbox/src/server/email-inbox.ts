import { randomUUID } from "node:crypto";
import { type CapturedEmail } from "../email";
import { type EmailPayload } from "../email-payload";

const MAX_EMAIL_COUNT = 100;

export type EmailInbox = {
  add: (email: EmailPayload) => CapturedEmail;
  clear: () => void;
  list: () => CapturedEmail[];
};

/**
 * Keeps local messages for the lifetime of the Vite process so development
 * email never requires a database, migration, cleanup job, or production
 * service. The small limit prevents a long-running dev session from growing
 * without bound.
 */
export function createEmailInbox(): EmailInbox {
  let emails: CapturedEmail[] = [];

  return {
    add(email) {
      const capturedEmail = { ...email, id: randomUUID(), receivedAt: new Date().toISOString() };

      emails = [capturedEmail, ...emails].slice(0, MAX_EMAIL_COUNT);

      return capturedEmail;
    },
    clear() {
      emails = [];
    },
    list() {
      return emails;
    },
  };
}
