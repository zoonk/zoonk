"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  type AudioBlobCache,
  clearAudioObjectUrlCache,
  getCachedAudioSourceUrl,
  storeAudioObjectUrl,
} from "./_utils/audio-blob-cache";

const AUDIO_PRELOAD_CONCURRENCY = 2;

function getUniqueAudioUrls(urls?: (string | null)[]): string[] {
  if (!urls) {
    return [];
  }

  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

function getPreloadBatches(urls: string[]): string[][] {
  return Array.from({ length: Math.ceil(urls.length / AUDIO_PRELOAD_CONCURRENCY) }, (_, index) =>
    urls.slice(
      index * AUDIO_PRELOAD_CONCURRENCY,
      index * AUDIO_PRELOAD_CONCURRENCY + AUDIO_PRELOAD_CONCURRENCY,
    ),
  );
}

async function preloadAudioBlob({
  cache,
  signal,
  sourceUrl,
}: {
  cache: AudioBlobCache;
  signal: AbortSignal;
  sourceUrl: string;
}): Promise<void> {
  if (cache.has(sourceUrl)) {
    return;
  }

  try {
    const response = await fetch(sourceUrl, { signal });

    if (!response.ok) {
      return;
    }

    const blob = await response.blob();

    if (signal.aborted) {
      return;
    }

    storeAudioObjectUrl({
      cache,
      objectUrl: URL.createObjectURL(blob),
      revokeObjectUrl: (objectUrl) => URL.revokeObjectURL(objectUrl),
      sourceUrl,
    });
  } catch {
    // Cross-origin assets can reject preloading while their original URL still plays.
  }
}

async function preloadAudioBatch({
  batch,
  cache,
  signal,
}: {
  batch: string[];
  cache: AudioBlobCache;
  signal: AbortSignal;
}): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await Promise.all(batch.map((sourceUrl) => preloadAudioBlob({ cache, signal, sourceUrl })));
}

async function preloadAudioBlobs({
  cache,
  signal,
  urls,
}: {
  cache: AudioBlobCache;
  signal: AbortSignal;
  urls: string[];
}): Promise<void> {
  return getPreloadBatches(urls).reduce(
    (pendingBatch, batch) => pendingBatch.then(() => preloadAudioBatch({ batch, cache, signal })),
    Promise.resolve(),
  );
}

/** Returns the source to play for a URL: its preloaded copy once it arrived, so it starts at once. */
export function useAudioPreload(urls?: (string | null)[]): (url: string) => string {
  const cacheRef = useRef<AudioBlobCache>(new Map());
  const preloadKey = getUniqueAudioUrls(urls).join("\n");

  useEffect(() => {
    const preloadUrls = preloadKey ? preloadKey.split("\n") : [];
    const abortController = new AbortController();

    void preloadAudioBlobs({
      cache: cacheRef.current,
      signal: abortController.signal,
      urls: preloadUrls,
    });

    return () => abortController.abort();
  }, [preloadKey]);

  useEffect(
    () => () => {
      clearAudioObjectUrlCache({
        cache: cacheRef.current,
        revokeObjectUrl: (objectUrl) => URL.revokeObjectURL(objectUrl),
      });
    },
    [],
  );

  return useCallback(
    (url: string) => getCachedAudioSourceUrl({ cache: cacheRef.current, sourceUrl: url }),
    [],
  );
}
