"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { createParser } from "eventsource-parser";
import { useEffect, useEffectEvent, useRef } from "react";
import { getWorkflowAuthHeaders } from "./auth-headers";

export function useGenerationEvents({
  connection,
  onComplete,
  onError,
  onMessage,
  onOpen,
  runId,
}: {
  connection: number;
  onComplete: () => void;
  onError: () => void;
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

    if (cursor.current.key !== runId) {
      cursor.current = { index: 0, key: runId };
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const url = `${getBrowserApiUrl()}/v1/generations/${encodeURIComponent(runId)}/events?startIndex=${cursor.current.index}`;
        const headers = await getWorkflowAuthHeaders();

        const response = await fetch(url, { headers, signal: controller.signal });

        if (!response.ok) {
          onErrorEvent();
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

        onCompleteEvent();
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          onErrorEvent();
        }
      }
    })();

    return () => controller.abort();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Reconnecting reopens the same run at its cursor.
  }, [connection, runId]);
}
