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

/**
 * Word banks can repeat the same audio URL or include empty entries. Normalizing the list in one
 * place keeps the preload effect focused on the small set of files that can actually be played.
 */
function getUniqueAudioUrls(urls?: (string | null)[]): string[] {
  if (!urls) {
    return [];
  }

  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

/**
 * The blob preloader works in small waves so a word bank can warm its clips
 * without asking mobile Safari to start every media request at once.
 */
function getPreloadBatches(urls: string[]): string[][] {
  return Array.from({ length: Math.ceil(urls.length / AUDIO_PRELOAD_CONCURRENCY) }, (_, index) =>
    urls.slice(
      index * AUDIO_PRELOAD_CONCURRENCY,
      index * AUDIO_PRELOAD_CONCURRENCY + AUDIO_PRELOAD_CONCURRENCY,
    ),
  );
}

/**
 * Fetches audio bytes into a blob URL instead of creating a permanent media
 * element for each word. If fetch fails because a remote asset does not allow
 * CORS, playback still falls back to the original URL when the learner taps.
 */
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
    // Fetch preloading is opportunistic. Playback can still use the original URL.
  }
}

/**
 * Runs one bounded preload wave. Keeping this separate makes the reducer below
 * read as a sequence of small concurrent batches instead of hiding fetch logic
 * inside promise chaining.
 */
function preloadAudioBatch({
  batch,
  cache,
  signal,
}: {
  batch: string[];
  cache: AudioBlobCache;
  signal: AbortSignal;
}): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return Promise.all(batch.map((sourceUrl) => preloadAudioBlob({ cache, signal, sourceUrl }))).then(
    () => {
      // The ordered preloader only cares that the batch finished.
    },
  );
}

/**
 * Preloads a bounded set of audio blobs with limited concurrency. The hook
 * deliberately waits for each small wave before starting the next one so the
 * player warms audio without competing with step rendering and taps.
 */
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

/**
 * Reusing one playback element keeps Safari from holding a media element per
 * word-bank option. The preloader warms bytes separately; this element only
 * owns the clip the learner is actively playing.
 */
function createAudioElement(onEnded: () => void): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("ended", onEnded);
  return audio;
}

/**
 * Starts a source from the beginning on the reusable playback element.
 * Reassigning the source on every tap avoids Safari's ended-element replay
 * bug while still keeping only one media element alive.
 */
function startAudioFromSource(audio: HTMLAudioElement, sourceUrl: string): void {
  audio.pause();
  audio.src = sourceUrl;
  audio.currentTime = 0;
}

/**
 * Browsers confirm media playback asynchronously and may reject audible audio
 * when the call is not tied to an accepted user gesture. Returning an explicit
 * status lets controls show the pause state only after playback really starts.
 */
async function getAudioPlaybackStatus(audio: HTMLAudioElement): Promise<AudioPlaybackStatus> {
  try {
    await audio.play();
    return "started";
  } catch {
    return "failed";
  }
}

/**
 * Short language clips need to start as close to instantly as possible. This
 * hook warms audio bytes in a bounded blob cache, then plays those bytes through
 * one reusable media element so mobile Safari does not retain a media element
 * for every word-bank option.
 */
export function useWordAudio(options?: UseWordAudioOptions): {
  pause: () => void;
  play: (url: string | null) => Promise<AudioPlaybackStatus>;
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

  // The media listener is installed once on a lazily created audio element. Keeping the latest
  // consumer callback in a ref avoids rebuilding that element when its owner re-renders.
  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  }, [options?.onEnded]);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    // Safari can get stuck when replaying an element that naturally ended.
    // Clearing the source leaves the reusable element alive but resets the
    // browser media state before the next tap assigns a fresh source.
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
    async (url: string | null) => {
      if (!url) {
        return "failed";
      }

      const audio = getAudio();

      const sourceUrl = getCachedAudioSourceUrl({
        cache: audioBlobCacheRef.current,
        sourceUrl: url,
      });

      startAudioFromSource(audio, sourceUrl);
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
