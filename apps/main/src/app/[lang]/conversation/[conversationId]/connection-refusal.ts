import { type ConversationConnection } from "@zoonk/learn/language/conversation";
import { getString, isJsonObject } from "@zoonk/utils/json";

const periods = ["day", "month", "total"] as const;
const tiers = ["free", "guest", "plus"] as const;

export function readConnectionRefusal(
  body: unknown,
): Exclude<ConversationConnection, { status: "ready" }> {
  const error = isJsonObject(body) ? body.error : null;
  const details = isJsonObject(error) ? error.details : null;

  switch (getString(error, "code") ?? "") {
    case "CALLS_PAUSED":
      return { status: "callsPaused" };
    case "CALL_IN_PROGRESS":
      return { status: "callInProgress" };
    case "PREVIOUS_CONNECTION_CLOSING":
      return { status: "previousConnectionClosing" };
    case "PLUS_REQUIRED":
      return { status: "plusRequired" };
    case "CONVERSATION_ENDED":
      return { status: "ended" };
    case "CONVERSATION_LIMIT_REACHED": {
      const period = periods.find((value) => value === getString(details, "period"));
      const tier = tiers.find((value) => value === getString(details, "tier"));
      return period && tier ? { limit: { period, tier }, status: "limit" } : { status: "failed" };
    }
    case "CONNECTION_LIMIT_REACHED":
      return getString(details, "period") === "conversation"
        ? { status: "ended" }
        : { limit: { period: "day", tier: "plus" }, status: "limit" };
    case "SIGN_UP_REQUIRED":
      return { limit: { period: "total", tier: "guest" }, status: "limit" };
    default:
      return { status: "failed" };
  }
}
