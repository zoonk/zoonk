const MAX_AUDIO_BLOB_CACHE_ENTRIES = 16;

export type AudioBlobCache = Map<string, string>;

type RevokeObjectUrl = (objectUrl: string) => void;

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
