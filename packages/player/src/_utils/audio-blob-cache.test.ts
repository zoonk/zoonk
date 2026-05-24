import { describe, expect, it, vi } from "vitest";
import {
  type AudioBlobCache,
  clearAudioObjectUrlCache,
  getCachedAudioSourceUrl,
  storeAudioObjectUrl,
} from "./audio-blob-cache";

describe("audio blob cache", () => {
  it("falls back to the source URL when audio was not prefetched", () => {
    const cache: AudioBlobCache = new Map();

    expect(getCachedAudioSourceUrl({ cache, sourceUrl: "/audio/one.mp3" })).toBe("/audio/one.mp3");
  });

  it("promotes cached audio when it is used", () => {
    const cache: AudioBlobCache = new Map([
      ["/audio/one.mp3", "blob:one"],
      ["/audio/two.mp3", "blob:two"],
    ]);

    expect(getCachedAudioSourceUrl({ cache, sourceUrl: "/audio/one.mp3" })).toBe("blob:one");
    expect([...cache.keys()]).toStrictEqual(["/audio/two.mp3", "/audio/one.mp3"]);
  });

  it("evicts and revokes the least recently used object URL", () => {
    const cache: AudioBlobCache = new Map([
      ["/audio/one.mp3", "blob:one"],
      ["/audio/two.mp3", "blob:two"],
    ]);

    const revokeObjectUrl = vi.fn();

    storeAudioObjectUrl({
      cache,
      maxEntries: 2,
      objectUrl: "blob:three",
      revokeObjectUrl,
      sourceUrl: "/audio/three.mp3",
    });

    expect([...cache.entries()]).toStrictEqual([
      ["/audio/two.mp3", "blob:two"],
      ["/audio/three.mp3", "blob:three"],
    ]);

    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:one");
  });

  it("revokes the previous object URL when replacing a cached source", () => {
    const cache: AudioBlobCache = new Map([["/audio/one.mp3", "blob:one"]]);
    const revokeObjectUrl = vi.fn();

    storeAudioObjectUrl({
      cache,
      objectUrl: "blob:one-new",
      revokeObjectUrl,
      sourceUrl: "/audio/one.mp3",
    });

    expect([...cache.entries()]).toStrictEqual([["/audio/one.mp3", "blob:one-new"]]);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:one");
  });

  it("clears every cached object URL", () => {
    const cache: AudioBlobCache = new Map([
      ["/audio/one.mp3", "blob:one"],
      ["/audio/two.mp3", "blob:two"],
    ]);

    const revokeObjectUrl = vi.fn();

    clearAudioObjectUrlCache({ cache, revokeObjectUrl });

    expect(cache.size).toBe(0);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:one");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:two");
  });
});
