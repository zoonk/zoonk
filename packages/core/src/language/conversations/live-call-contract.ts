import { type LiveCallConnection } from "@zoonk/db";
import { type UsageDecision } from "../../entitlements/contract";

export type LiveCallRefusal =
  | Exclude<UsageDecision, { status: "allowed" }>
  | {
      status:
        | "callsPaused"
        | "conversationEnded"
        | "plusRequired"
        | "notFound"
        | "previousConnectionClosing"
        | "retryable";
    }
  | { connectionId: string; conversationId: string; status: "callInProgress" }
  | { period: "day"; status: "connectionLimitReached" };

export type LiveCallReservationResult =
  | LiveCallRefusal
  | { connection: LiveCallConnection; endsAtLimit: "day" | "month" | null; status: "reserved" };

/** Starts the durable run that ends the connection at its deadline. */
export type LiveCallDeadlineScheduler = (input: {
  connectionId: string;
  deadlineAt: Date;
}) => Promise<unknown>;
