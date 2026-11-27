"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { createParser } from "eventsource-parser";
import { useEffect, useEffectEvent, useRef } from "react";
import { getWorkflowAuthHeaders } from "./auth-headers";

export function useGenerationEvents({
  connection,
  namespace,
  onComplete,
  onError,
  onMessage,
  onOpen,
  runId,
}: {
  connection: number;
  namespace: string | null;
  onComplete: (runId: string) => void;
  onError: (responseStatus?: number) => void;
  onMessage: (data: StepStreamMessage) => void;
  onOpen: (response: Response) => void;
  runId: string | null;
}) {
  const cursor = useRef<{ index: number; key: string | null }>({ index: 0, key: null });

  const onMessageEvent = useEffectEvent(onMessage);
  const onOpenEvent = useEffectEvent(onOpen);
  const onCompleteEvent = useEffectEvent(onComplete);
  const onErrorEvent = useEffectEvent(onError);

  useEffect(() => {
    if (!runId) {
      return;
    }

    const key = JSON.stringify([runId, namespace]);

    if (cursor.current.key !== key) {
      cursor.current = { index: 0, key };
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const query = new URLSearchParams({ startIndex: String(cursor.current.index) });

        if (namespace) {
          query.set("namespace", namespace);
        }

        const url = `${getBrowserApiUrl()}/v1/generations/${encodeURIComponent(runId)}/events?${query}`;
        const headers = await getWorkflowAuthHeaders();

        const response = await fetch(url, { headers, signal: controller.signal });

        if (!response.ok) {
          onErrorEvent(response.status);
          return;
        }

        onOpenEvent(response);
        const reader = response.body?.getReader();

        if (!reader) {
          return;
        }

        const decoder = new TextDecoder();

        const parser = createParser({
          onEvent: (event) => {
            // A closed connection's last chunk may belong to a run that's no longer followed.
            if (controller.signal.aborted) {
              return;
            }

            cursor.current.index += 1;
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The API writes StepStreamMessage events.
            const data = JSON.parse(event.data) as StepStreamMessage;
            onMessageEvent(data);
          },
        });

        let result = await reader.read();
        /* eslint-disable no-await-in-loop -- Sequential stream reading is required */
        while (!result.done) {
          parser.feed(decoder.decode(result.value, { stream: true }));
          result = await reader.read();
        }
        /* eslint-enable no-await-in-loop */

        parser.feed(decoder.decode());

        onCompleteEvent(runId);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          onErrorEvent();
        }
      }
    })();

    return () => controller.abort();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Reconnecting reopens the same run at its cursor.
  }, [connection, namespace, runId]);
}
