import { randomUUID } from "node:crypto";
import { type EmailPayload } from "../email-payload.ts";
import { type CapturedEmail } from "../email.ts";

const MAX_EMAIL_COUNT = 100;

export type EmailInbox = {
  add: (email: EmailPayload) => CapturedEmail;
  clear: () => void;
  list: () => CapturedEmail[];
};

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
