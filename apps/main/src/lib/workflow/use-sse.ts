"use client";

import { type EventSourceMessage, createParser } from "eventsource-parser";
import { useEffect, useRef } from "react";

export function useSSE<T>(
  url: string | null,
  options: {
    onComplete?: () => void;
    onError?: (error: Error) => void;
    onMessage: (data: T) => void;
    startIndex?: number;
  },
) {
  const indexRef = useRef(options.startIndex ?? 0);
  const { onComplete, onError, onMessage } = options;

  useEffect(() => {
    if (!url) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const fullUrl = `${url}&startIndex=${indexRef.current}`;
        const response = await fetch(fullUrl, { signal: controller.signal });
        const reader = response.body?.getReader();
        if (!reader) {
          return;
        }

        const decoder = new TextDecoder();
        const parser = createParser({
          onEvent: (event: EventSourceMessage) => {
            indexRef.current += 1;
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SSE data type is validated by consumer
            const data = JSON.parse(event.data) as T;
            onMessage(data);
          },
        });

        let result = await reader.read();
        /* eslint-disable no-await-in-loop -- Sequential stream reading is required */
        while (!result.done) {
          parser.feed(decoder.decode(result.value, { stream: true }));
          result = await reader.read();
        }
        /* eslint-enable no-await-in-loop */

        onComplete?.();
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          onError?.(error);
        }
      }
    })();

    return () => controller.abort();
  }, [url, onComplete, onError, onMessage]);

  return {
    resetIndex: () => {
      indexRef.current = 0;
    },
  };
}
