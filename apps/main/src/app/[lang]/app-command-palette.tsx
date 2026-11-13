"use client";

import { getLearnerSummaryState, subscribeToLearnerSummary } from "@/lib/learner/learner-store";
import { hasSessionHint } from "@/lib/learner/session-hint";
import { runWhenIdle } from "@/lib/run-when-idle";
import { useShortcut } from "@zoonk/ui/hooks/keyboard";
import {
  listenForCommandPaletteRequest,
  openCommandPalette,
} from "@zoonk/ui/lib/command-palette-event";
import { Suspense, lazy, useEffect, useState, useSyncExternalStore } from "react";

const loadPalette = () => import("./app-command-palette-dialog");
const AppCommandPaletteDialog = lazy(loadPalette);

const frameScopes = { count: 0, listeners: new Set<() => void>() };

function changeFrameScopes(change: 1 | -1) {
  frameScopes.count += change;
  frameScopes.listeners.forEach((listener) => listener());
}

export function CommandPaletteScope() {
  useEffect(() => {
    changeFrameScopes(1);
    return () => changeFrameScopes(-1);
  }, []);

  return null;
}

/** Anyone with a session has the palette everywhere; a visitor has it only in the app's frame. */
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

function usePaletteAllowed(): boolean {
  return useSyncExternalStore(subscribeToPaletteScope, canOpenPalette, () => false);
}

function usePreloadOnIdle() {
  useEffect(() => {
    if (!canOpenPalette()) {
      return;
    }

    return runWhenIdle(() => void loadPalette());
  }, []);
}

export function AppCommandPalette() {
  const [requested, setRequested] = useState(false);
  const allowed = usePaletteAllowed();
  const mounted = requested && allowed;

  usePreloadOnIdle();

  // Until the palette mounts and takes the key itself, the key asks for it.
  useShortcut("search", () => (canOpenPalette() ? openCommandPalette() : false), {
    enabled: !mounted,
  });

  useEffect(() => {
    if (mounted) {
      return;
    }

    return listenForCommandPaletteRequest(() => setRequested(true));
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
