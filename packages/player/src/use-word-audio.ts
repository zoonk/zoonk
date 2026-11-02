"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  type AudioBlobCache,
  clearAudioObjectUrlCache,
  getCachedAudioSourceUrl,
  storeAudioObjectUrl,
} from "./_utils/audio-blob-cache";

type UseWordAudioOptions = { onEnded?: () => void; preloadUrls?: (string | null)[] };
type AudioPlaybackStatus = "failed" | "started";

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

function createAudioElement(onEnded: () => void): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("ended", onEnded);
  return audio;
}

// Resetting the source avoids Safari's replay failure after a clip ends.
function startAudioFromSource({
  audio,
  rate,
  sourceUrl,
}: {
  audio: HTMLAudioElement;
  rate: number;
  sourceUrl: string;
}): void {
  audio.pause();
  audio.src = sourceUrl;
  audio.currentTime = 0;
  audio.playbackRate = rate;
}

// Audible playback can be rejected without an accepted user gesture.
async function getAudioPlaybackStatus(audio: HTMLAudioElement): Promise<AudioPlaybackStatus> {
  try {
    await audio.play();
    return "started";
  } catch {
    return "failed";
  }
}

export function useWordAudio(options?: UseWordAudioOptions): {
  pause: () => void;
  /** `rate` below 1 plays a slower version at the same pitch, for hearing each sound. */
  play: (url: string | null, playback?: { rate?: number }) => Promise<AudioPlaybackStatus>;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobCacheRef = useRef<AudioBlobCache>(new Map());
  const onEndedRef = useRef(options?.onEnded);
  const preloadKey = getUniqueAudioUrls(options?.preloadUrls).join("\n");

  const releaseAudioSource = useCallback((audio: HTMLAudioElement) => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);

  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  }, [options?.onEnded]);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    // Reset Safari's ended media state before the next tap reuses the element.
    releaseAudioSource(audio);

    onEndedRef.current?.();
  }, [releaseAudioSource]);

  const getAudio = useCallback(() => {
    const existingAudio = audioRef.current;

    if (existingAudio) {
      return existingAudio;
    }

    const audio = createAudioElement(handleEnded);

    audioRef.current = audio;

    return audio;
  }, [handleEnded]);

  const play = useCallback(
    async (url: string | null, playback?: { rate?: number }) => {
      if (!url) {
        return "failed";
      }

      const audio = getAudio();

      const sourceUrl = getCachedAudioSourceUrl({
        cache: audioBlobCacheRef.current,
        sourceUrl: url,
      });

      startAudioFromSource({ audio, rate: playback?.rate ?? 1, sourceUrl });
      return getAudioPlaybackStatus(audio);
    },
    [getAudio],
  );

  const pause = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    releaseAudioSource(audio);
  }, [releaseAudioSource]);

  useEffect(() => {
    const preloadUrls = preloadKey ? preloadKey.split("\n") : [];
    const abortController = new AbortController();

    void preloadAudioBlobs({
      cache: audioBlobCacheRef.current,
      signal: abortController.signal,
      urls: preloadUrls,
    });

    return () => abortController.abort();
  }, [preloadKey]);

  useEffect(
    () => () => {
      const audio = audioRef.current;

      if (audio) {
        releaseAudioSource(audio);
        audioRef.current = null;
      }

      clearAudioObjectUrlCache({
        cache: audioBlobCacheRef.current,
        revokeObjectUrl: (objectUrl) => URL.revokeObjectURL(objectUrl),
      });
    },
    [releaseAudioSource],
  );

  return { pause, play };
}
