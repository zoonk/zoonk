"use client";

import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";

type LiveCallSetup = Pick<
  LanguageConversationSetup,
  "connectionId" | "deadlineAt" | "endsAtLimit" | "seconds" | "sessionUrl"
>;

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

export type CallConnectionActions = {
  /** Reserves the call; `takeover` ends the learner's other open call first. */
  connect: (input: { takeover: boolean }) => Promise<ConversationConnection>;
  end: (
    connectionId: string,
  ) => Promise<
    | { endedAtDeadline: boolean; status: "closed" }
    | { status: "failed" | "previousConnectionClosing" }
  >;
};

const FAILED = { status: "failed" } as const;

/** `end` resolves true once the server confirmed, which stays true, and false while it hasn't, so asking again sends a new request. */
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

  const endedByServer = useCallback(async () => (await end()) && endedAtDeadline.current, [end]);

  return { end, endedByServer, getConnectionId, reconnecting, reserve };
}
