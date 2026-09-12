import {
  type CompletionInput,
  type CompletionResult,
} from "@zoonk/core/player/contracts/completion-input-schema";

export type PlayerCompletionOutcome =
  | { status: "completed"; result?: CompletionResult }
  | { status: "failed" }
  | { status: "superseded" };

/** A synchronous void callback is local guest completion; authenticated hosts return an authoritative outcome. */
export type PlayerCompletionHandler =
  | ((input: CompletionInput) => void)
  | ((input: CompletionInput) => PlayerCompletionOutcome | Promise<PlayerCompletionOutcome>);
export type CompletionPersistence = "idle" | "saving" | "failed" | "superseded";
