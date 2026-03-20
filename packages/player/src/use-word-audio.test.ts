// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useWordAudio } from "./use-word-audio";

class MockAudio {
  static instances: MockAudio[] = [];

  currentTime = 0;
  preload = "";
  readyState = 0;
  src = "";

  private readonly listeners = new Map<string, (() => void)[]>();

  addEventListener = vi.fn((event: string, handler: () => void) => {
    const currentHandlers = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...currentHandlers, handler]);
  });

  load = vi.fn(() => {
    this.readyState = 4;
  });

  pause = vi.fn();

  play = vi.fn(() => Promise.resolve());

  removeAttribute = vi.fn((attribute: string) => {
    if (attribute === "src") {
      this.src = "";
    }
  });

  constructor() {
    MockAudio.instances.push(this);
  }

  dispatch(event: string) {
    this.listeners.get(event)?.forEach((handler) => handler());
  }
}

describe(useWordAudio, () => {
  beforeEach(() => {
    MockAudio.instances = [];
    vi.stubGlobal("Audio", MockAudio as unknown as typeof Audio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("preloads each unique audio url once and reuses it for playback", () => {
    const urlA = "https://example.com/a.mp3";
    const urlB = "https://example.com/b.mp3";
    const { result } = renderHook(() => useWordAudio({ preloadUrls: [urlA, null, urlA, urlB] }));

    expect(MockAudio.instances).toHaveLength(2);

    const [audioA, audioB] = MockAudio.instances;

    expect(audioA?.src).toBe(urlA);
    expect(audioB?.src).toBe(urlB);
    expect(audioA?.load).toHaveBeenCalledOnce();
    expect(audioB?.load).toHaveBeenCalledOnce();

    act(() => {
      result.current.play(urlA);
    });

    expect(MockAudio.instances).toHaveLength(2);
    expect(audioA?.play).toHaveBeenCalledOnce();
  });

  test("playing a new url stops the previous clip and restarts the next one from the beginning", () => {
    const urlA = "https://example.com/a.mp3";
    const urlB = "https://example.com/b.mp3";
    const { result } = renderHook(() => useWordAudio({ preloadUrls: [urlA, urlB] }));
    const [audioA, audioB] = MockAudio.instances;

    if (!audioA || !audioB) {
      throw new Error("Expected preloaded audio instances");
    }

    audioA.currentTime = 1.2;
    audioB.currentTime = 2.4;

    act(() => {
      result.current.play(urlA);
    });

    act(() => {
      result.current.play(urlB);
    });

    expect(audioA.pause).toHaveBeenCalledOnce();
    expect(audioA.currentTime).toBe(0);
    expect(audioB.currentTime).toBe(0);
    expect(audioB.play).toHaveBeenCalledOnce();
  });

  test("forwards ended events to the caller", () => {
    const onEnded = vi.fn();
    const url = "https://example.com/a.mp3";
    const { result } = renderHook(() => useWordAudio({ onEnded }));

    act(() => {
      result.current.play(url);
    });

    const [audio] = MockAudio.instances;

    if (!audio) {
      throw new Error("Expected a created audio instance");
    }

    act(() => {
      audio.dispatch("ended");
    });

    expect(onEnded).toHaveBeenCalledOnce();
  });
});
