import { toError } from "@zoonk/utils/error";
import { z } from "zod";
import { isTestEnvironment } from "../../../../_utils/is-test-environment";
import { type LiveCallSessionClosed, readLiveCallClosedEvent } from "./live-call-closed-event";

/** Node supports authenticated WebSocketInit; the shared DOM lib omits its server overload. */
function createSidebandSocket({ headers, url }: { headers: Record<string, string>; url: string }) {
  const socket: unknown = Reflect.construct(WebSocket, [url, { headers }]);

  if (!(socket instanceof WebSocket)) {
    throw new Error("Live call sideband needs the server WebSocket implementation.");
  }

  return socket;
}

/** A transport closing or an attach error (including 404) never establishes session termination. */
export async function closeLiveCallSideband({
  deadlineAt,
  headers,
  providerSessionId,
  url,
}: {
  deadlineAt: number;
  headers: Record<string, string>;
  providerSessionId: string;
  url: string;
}): Promise<LiveCallSessionClosed> {
  if (isTestEnvironment()) {
    throw new Error("Direct provider calls are disabled during tests.");
  }

  const sessionId = z.string().min(1).parse(providerSessionId);

  const socket = createSidebandSocket({
    headers,
    url: `${url}/${encodeURIComponent(sessionId)}/attach`,
  });

  return new Promise((resolve, reject) => {
    const listeners = new AbortController();

    const timeout = setTimeout(
      () => fail(new Error("Live call close timed out without confirmed finalization.")),
      Math.max(0, deadlineAt - Date.now()),
    );

    function cleanup() {
      clearTimeout(timeout);
      listeners.abort();
      socket.close();
    }

    function fail(error: Error) {
      cleanup();
      reject(error);
    }

    function onMessage(event: MessageEvent<unknown>) {
      if (Date.now() >= deadlineAt) {
        fail(new Error("Live call close timed out without confirmed finalization."));
        return;
      }

      try {
        const closed = readLiveCallClosedEvent({ data: event.data, providerSessionId: sessionId });

        if (!closed) {
          return;
        }

        cleanup();
        resolve(closed);
      } catch (error) {
        fail(toError(error));
      }
    }

    function onOpen() {
      if (Date.now() >= deadlineAt) {
        fail(new Error("Live call close timed out without confirmed finalization."));
        return;
      }

      try {
        socket.send(JSON.stringify({ type: "session.close" }));
      } catch (error) {
        fail(toError(error));
      }
    }

    /** Install the terminal receiver before the open handler can submit session.close. */
    socket.addEventListener("message", onMessage, { signal: listeners.signal });

    socket.addEventListener(
      "error",
      () => fail(new Error("Live call sideband attachment failed.")),
      { signal: listeners.signal },
    );

    socket.addEventListener(
      "close",
      () => fail(new Error("Live call sideband closed without confirmed finalization.")),
      { signal: listeners.signal },
    );

    socket.addEventListener("open", onOpen, { once: true, signal: listeners.signal });
  });
}
