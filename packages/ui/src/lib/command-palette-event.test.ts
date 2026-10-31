import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dropPendingCommandPalette,
  listenForCommandPaletteOpen,
  listenForCommandPaletteRequest,
  openCommandPalette,
} from "./command-palette-event";

describe("command palette requests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dropPendingCommandPalette();
  });

  afterEach(() => {
    dropPendingCommandPalette();
    vi.useRealTimers();
  });

  it("opens a mounted palette without leaving a request for the next mount", () => {
    const open = vi.fn();
    const stop = listenForCommandPaletteOpen(open);
    openCommandPalette();
    expect(open).toHaveBeenCalledOnce();
    stop();

    const nextOpen = vi.fn();
    const stopNext = listenForCommandPaletteOpen(nextOpen);
    expect(nextOpen).not.toHaveBeenCalled();
    stopNext();
  });

  it("loads an unmounted palette and replays its request only once", () => {
    const request = vi.fn();
    const stopRequest = listenForCommandPaletteRequest(request);
    openCommandPalette();
    expect(request).toHaveBeenCalledOnce();
    stopRequest();

    const open = vi.fn();
    const stop = listenForCommandPaletteOpen(open);
    expect(open).toHaveBeenCalledOnce();
    stop();

    const nextOpen = vi.fn();
    const stopNext = listenForCommandPaletteOpen(nextOpen);
    expect(nextOpen).not.toHaveBeenCalled();
    stopNext();
  });

  it("loads the palette when its request listener mounts after the click", () => {
    openCommandPalette();
    const request = vi.fn();
    const stopRequest = listenForCommandPaletteRequest(request);
    expect(request).toHaveBeenCalledOnce();
    stopRequest();

    const open = vi.fn();
    const stop = listenForCommandPaletteOpen(open);
    expect(open).toHaveBeenCalledOnce();
    stop();
  });

  it("does not reopen for an expired request", () => {
    openCommandPalette();
    vi.advanceTimersByTime(10_000);
    const open = vi.fn();
    const stop = listenForCommandPaletteOpen(open);
    expect(open).not.toHaveBeenCalled();
    stop();

    const request = vi.fn();
    const stopRequest = listenForCommandPaletteRequest(request);
    expect(request).not.toHaveBeenCalled();
    stopRequest();
  });

  it("drops a request when leaving the palette's scope", () => {
    openCommandPalette();
    dropPendingCommandPalette();
    const open = vi.fn();
    const stop = listenForCommandPaletteOpen(open);
    expect(open).not.toHaveBeenCalled();
    stop();
  });

  it("removes the request listener on cleanup", () => {
    const request = vi.fn();
    const stop = listenForCommandPaletteRequest(request);
    stop();
    openCommandPalette();
    expect(request).not.toHaveBeenCalled();
  });
});
