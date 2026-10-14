"use client";

import {
  listenForCommandPaletteRequest,
  openCommandPalette,
} from "@/app/[lang]/(app)/(catalog)/_components/command-palette-event";
import { getLearnerSummaryState, subscribeToLearnerSummary } from "@/lib/learner/learner-store";
import { hasSessionHint } from "@/lib/learner/session-hint";
import { Suspense, lazy, useEffect, useState, useSyncExternalStore } from "react";

const loadPalette = () => import("./app-command-palette-dialog");

/** Where the browser can't say when it's idle, the palette's code loads this long after the page. */
const PRELOAD_DELAY_MS = 2000;
const AppCommandPaletteDialog = lazy(loadPalette);

/** How many frames are mounted: a visitor's Cmd/Ctrl+K opens the palette only in the app's frame. */
const frameScopes = { count: 0, listeners: new Set<() => void>() };

function changeFrameScopes(change: 1 | -1) {
  frameScopes.count += change;
  frameScopes.listeners.forEach((listener) => listener());
}

/** Marks the app's frame as mounted, where a visitor's Cmd/Ctrl+K opens the palette too. */
export function CommandPaletteScope() {
  useEffect(() => {
    changeFrameScopes(1);
    return () => changeFrameScopes(-1);
  }, []);

  return null;
}

/** Anyone with a session has the palette everywhere; a visitor has it in the app's frame. */
function canOpenPalette(): boolean {
  return frameScopes.count > 0 || hasSessionHint() || getLearnerSummaryState().status === "ready";
}

function subscribeToPaletteScope(listener: () => void): () => void {
  frameScopes.listeners.add(listener);
  const stopLearner = subscribeToLearnerSummary(listener);

  return () => {
    frameScopes.listeners.delete(listener);
    stopLearner();
  };
}

/**
 * Whether the palette belongs on this page now. A visitor who opened it in the frame and moved to
 * a public page loses it there (its code stays loaded), shortcut included.
 */
function usePaletteAllowed(): boolean {
  return useSyncExternalStore(subscribeToPaletteScope, canOpenPalette, () => false);
}

function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

/**
 * Loads the palette's code once the page is idle where it can open (for anyone with a session, or
 * in the app's frame), so the first Cmd/Ctrl+K opens it at once; a visitor's public page never
 * loads it.
 */
function usePreloadOnIdle() {
  useEffect(() => {
    if (!canOpenPalette()) {
      return;
    }

    if (!("requestIdleCallback" in globalThis)) {
      const timer = setTimeout(() => void loadPalette(), PRELOAD_DELAY_MS);
      return () => clearTimeout(timer);
    }

    const idle = requestIdleCallback(() => void loadPalette());
    return () => cancelIdleCallback(idle);
  }, []);
}

/**
 * Cmd/Ctrl+K search, commands and questions from any page: the palette's code loads on the first
 * request (the shortcut, a search field, the account menu's "Search"), or when the page is idle,
 * and it reads the learner from the learner summary. A request made before it arrived opens it as
 * it mounts (`listenForCommandPaletteOpen`).
 */
export function AppCommandPalette() {
  const [requested, setRequested] = useState(false);
  const allowed = usePaletteAllowed();
  const mounted = requested && allowed;

  usePreloadOnIdle();

  useEffect(() => {
    if (mounted) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!isPaletteShortcut(event) || !canOpenPalette()) {
        return;
      }

      event.preventDefault();
      openCommandPalette();
    }

    const stopListening = listenForCommandPaletteRequest(() => setRequested(true));
    globalThis.addEventListener("keydown", onKeyDown);

    return () => {
      stopListening();
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AppCommandPaletteDialog />
    </Suspense>
  );
}
