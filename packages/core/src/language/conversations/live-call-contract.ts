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
  | { period: "day" | "conversation"; status: "connectionLimitReached" };

export type LiveCallReservationResult =
  | LiveCallRefusal
  | { connection: LiveCallConnection; endsAtLimit: "day" | "month" | null; status: "reserved" };

type LiveCallDeadlineInput = { connectionId: string; deadlineAt: Date; generation: number };
export type LiveCallDeadlineScheduler = (
  input: LiveCallDeadlineInput,
) => Promise<{ runId: string }>;
export type CloseLiveCallResult = { status: "closed" | "closing" | "stale" | "notFound" };
