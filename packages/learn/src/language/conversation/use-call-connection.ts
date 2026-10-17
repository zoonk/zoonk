"use client";

import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";

/** What opening a call needs from the server's reservation; the host may pass the whole setup. */
type LiveCallSetup = Pick<
  LanguageConversationSetup,
  "connectionId" | "deadlineAt" | "endsAtLimit" | "seconds" | "sessionUrl"
>;

/**
 * Reserving a call: its setup, or why it can't be made now: the plan's call time is used, it
 * ended, it's left to Plus, calls are paused, another call of the learner's is open, or this
 * call's last connection is still closing.
 */
export type ConversationConnection =
  | { setup: LiveCallSetup; status: "ready" }
  | { limit: CallLimit; status: "limit" }
  | {
      status:
        | "callInProgress"
        | "callsPaused"
        | "ended"
        | "failed"
        | "plusRequired"
        | "previousConnectionClosing";
    };

/** What the host does with the server for a call's connection. */
export type CallConnectionActions = {
  /**
   * Reserves the call. Sending the same `requestId` again is the same reservation; `takeover`
   * ends the learner's other open call first.
   */
  connect: (input: { requestId: string; takeover: boolean }) => Promise<ConversationConnection>;
  /** Closes the connection on the server, which collects the provider's final usage. */
  end: (
    connectionId: string,
  ) => Promise<{ status: "closed" | "failed" | "previousConnectionClosing" }>;
};

const FAILED = { status: "failed" } as const;

/**
 * A call run's one connection on the server. Reserving asks once and, while this call's last
 * connection is still closing, once more with the same request (`reconnecting` meanwhile). A
 * reservation that arrives after its start was cancelled (`isCurrent`) is ended at once. `end`
 * asks the server to close the connection, one request at a time: true once the server confirmed,
 * which stays true, and false while it hasn't, so asking again sends a new request.
 */
export function useCallConnection(actions: CallConnectionActions) {
  const [reconnecting, setReconnecting] = useState(false);
  const actionsRef = useRef(actions);
  const connectionId = useRef<string | null>(null);
  const confirmed = useRef(false);
  const ending = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);

  const end = useCallback((): Promise<boolean> => {
    const id = connectionId.current;

    // Nothing reserved is nothing open on the server.
    if (!id || confirmed.current) {
      return Promise.resolve(true);
    }

    ending.current ??= actionsRef.current
      .end(id)
      .then(
        (result) => {
          confirmed.current = result.status === "closed";
          return confirmed.current;
        },
        () => false,
      )
      .finally(() => {
        ending.current = null;
      });

    return ending.current;
  }, []);

  const reserve = useCallback(
    async ({
      isCurrent,
      takeover,
    }: {
      isCurrent: () => boolean;
      takeover: boolean;
    }): Promise<ConversationConnection | null> => {
      const input = { requestId: crypto.randomUUID(), takeover };
      const connect = () => actionsRef.current.connect(input).catch(() => FAILED);

      const retry = async () => {
        setReconnecting(true);
        return connect();
      };

      const first = await connect();

      const answer =
        first.status === "previousConnectionClosing" && isCurrent() ? await retry() : first;

      if (answer.status !== "ready") {
        return answer;
      }

      // A start cancelled meanwhile never connects: its reservation is ended at once, by its own ID,
      // before any offer is sent.
      if (!isCurrent()) {
        void actionsRef.current.end(answer.setup.connectionId).catch(() => null);
        return null;
      }

      connectionId.current = answer.setup.connectionId;
      return answer;
    },
    [],
  );

  const getConnectionId = useCallback(() => connectionId.current, []);

  return { end, getConnectionId, reconnecting, reserve };
}
