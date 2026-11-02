import { isJsonObject } from "@zoonk/utils/json";
import { type EmailPayload, isEmailPayload } from "./email-payload.ts";

export type CapturedEmail = EmailPayload & { id: string; receivedAt: string };

export type EmailInboxResponse = { emails: CapturedEmail[] };

export function isEmailInboxResponse(value: unknown): value is EmailInboxResponse {
  return isJsonObject(value) && Array.isArray(value.emails) && value.emails.every(isCapturedEmail);
}

function isCapturedEmail(value: unknown): value is CapturedEmail {
  return (
    isJsonObject(value) &&
    isEmailPayload(value) &&
    typeof value.id === "string" &&
    typeof value.receivedAt === "string"
  );
}
