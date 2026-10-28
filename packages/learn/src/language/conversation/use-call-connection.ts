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
  /** Reserves the call; `takeover` ends the learner's other open call first. */
  connect: (input: { takeover: boolean }) => Promise<ConversationConnection>;
  /**
   * Has the server hang the connection up and settle it; `endedAtDeadline` when the server had
   * already hung it up at the call's deadline.
   */
  end: (
    connectionId: string,
  ) => Promise<
    | { endedAtDeadline: boolean; status: "closed" }
    | { status: "failed" | "previousConnectionClosing" }
  >;
};

const FAILED = { status: "failed" } as const;

/**
 * A call run's one connection on the server. Reserving asks once and, while this call's last
 * connection is still closing, once more (`reconnecting` meanwhile). A
 * reservation that arrives after its start was cancelled (`isCurrent`) is ended at once. `end`
 * asks the server to close the connection, one request at a time: true once the server confirmed,
 * which stays true, and false while it hasn't, so asking again sends a new request. A tab that
 * closes with the connection open ends it on its way out.
 */
export function useCallConnection(actions: CallConnectionActions) {
  const [reconnecting, setReconnecting] = useState(false);
  const actionsRef = useRef(actions);
  const connectionId = useRef<string | null>(null);
  const sessionUrl = useRef<string | null>(null);
  const confirmed = useRef(false);
  const endedAtDeadline = useRef(false);
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
          endedAtDeadline.current = result.status === "closed" && result.endedAtDeadline;
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
      const connect = () => actionsRef.current.connect({ takeover }).catch(() => FAILED);

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
      sessionUrl.current = answer.setup.sessionUrl;
      return answer;
    },
    [],
  );

  // A closing tab can't wait for a Server Action: a keepalive request to the call's own route ends
  // it, so the learner is charged only what it ran and the session stops at once.
  useEffect(() => {
    const endOnPageHide = () => {
      if (sessionUrl.current && !confirmed.current) {
        void fetch(sessionUrl.current, { keepalive: true, method: "DELETE" }).catch(() => null);
      }
    };

    window.addEventListener("pagehide", endOnPageHide);
    return () => window.removeEventListener("pagehide", endOnPageHide);
  }, []);

  const getConnectionId = useCallback(() => connectionId.current, []);

  /** Ends the connection and says whether our server had already ended it at the deadline. */
  const endedByServer = useCallback(async () => (await end()) && endedAtDeadline.current, [end]);

  return { end, endedByServer, getConnectionId, reconnecting, reserve };
}
