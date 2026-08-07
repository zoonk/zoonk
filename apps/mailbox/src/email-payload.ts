import { isJsonObject, isOptionalString } from "@zoonk/utils/json";

export type EmailPayload = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
};

/** Validates the message fields shared by captured inbox responses and local writes. */
export function isEmailPayload(value: unknown): value is EmailPayload & Record<string, unknown> {
  return (
    isJsonObject(value) &&
    typeof value.to === "string" &&
    typeof value.subject === "string" &&
    isOptionalString(value.htmlBody) &&
    isOptionalString(value.textBody) &&
    isOptionalString(value.replyTo)
  );
}
