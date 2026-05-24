const MAX_AUDIO_BLOB_CACHE_ENTRIES = 16;

export type AudioBlobCache = Map<string, string>;

type RevokeObjectUrl = (objectUrl: string) => void;

/**
 * Promotes a cached audio blob URL when it is used so the bounded cache evicts
 * the least recently used audio instead of removing the clip the learner just
 * tapped. If a URL was not prefetched, playback should fall back to the
 * original source URL rather than blocking on a fetch.
 */
export function getCachedAudioSourceUrl({
  cache,
  sourceUrl,
}: {
  cache: AudioBlobCache;
  sourceUrl: string;
}): string {
  const objectUrl = cache.get(sourceUrl);

  if (!objectUrl) {
    return sourceUrl;
  }

  cache.delete(sourceUrl);
  cache.set(sourceUrl, objectUrl);

  return objectUrl;
}

/**
 * Stores one prefetched audio blob URL and keeps the cache bounded. iOS Safari
 * is sensitive to media resource pressure, so preloading must not grow with
 * every word bank or every step in a lesson.
 */
export function storeAudioObjectUrl({
  cache,
  maxEntries = MAX_AUDIO_BLOB_CACHE_ENTRIES,
  objectUrl,
  revokeObjectUrl,
  sourceUrl,
}: {
  cache: AudioBlobCache;
  maxEntries?: number;
  objectUrl: string;
  revokeObjectUrl: RevokeObjectUrl;
  sourceUrl: string;
}): void {
  const existingObjectUrl = cache.get(sourceUrl);

  if (existingObjectUrl) {
    revokeObjectUrl(existingObjectUrl);
    cache.delete(sourceUrl);
  }

  cache.set(sourceUrl, objectUrl);

  while (cache.size > maxEntries) {
    const oldestSourceUrl = cache.keys().next().value;

    if (!oldestSourceUrl) {
      return;
    }

    const oldestObjectUrl = cache.get(oldestSourceUrl);

    if (oldestObjectUrl) {
      revokeObjectUrl(oldestObjectUrl);
    }

    cache.delete(oldestSourceUrl);
  }
}

/**
 * Revokes every object URL before the hook unmounts so prefetched audio bytes
 * are released when the player moves to a new step or leaves the lesson.
 */
export function clearAudioObjectUrlCache({
  cache,
  revokeObjectUrl,
}: {
  cache: AudioBlobCache;
  revokeObjectUrl: RevokeObjectUrl;
}): void {
  cache.forEach((objectUrl) => revokeObjectUrl(objectUrl));
  cache.clear();
}
