"use client";

import { createParser, type EventSourceMessage } from "eventsource-parser";
import { useEffect, useRef } from "react";

type UseSSEOptions<T> = {
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onMessage: (data: T) => void;
  startIndex?: number;
};

export function useSSE<T>(url: string | null, options: UseSSEOptions<T>) {
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
            const data = JSON.parse(event.data) as T;
            onMessage(data);
          },
        });

        let result = await reader.read();
        while (!result.done) {
          parser.feed(decoder.decode(result.value, { stream: true }));
          result = await reader.read();
        }

        onComplete?.();
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          onError?.(err);
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
