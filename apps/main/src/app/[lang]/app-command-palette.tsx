"use client";

import { getLearnerSummaryState, subscribeToLearnerSummary } from "@/lib/learner/learner-store";
import { hasSessionHint } from "@/lib/learner/session-hint";
import { runWhenIdle } from "@/lib/run-when-idle";
import {
  listenForCommandPaletteRequest,
  openCommandPalette,
} from "@zoonk/ui/lib/command-palette-event";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { useEffect, useState, useSyncExternalStore } from "react";

const paletteDialog = createOnDemand(() => import("./app-command-palette-dialog"));

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

function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

function usePreloadOnIdle() {
  useEffect(() => {
    if (!canOpenPalette()) {
      return;
    }

    return runWhenIdle(() => void paletteDialog.load());
  }, []);
}

export function AppCommandPalette() {
  const [requested, setRequested] = useState(false);
  const allowed = usePaletteAllowed();
  const Dialog = paletteDialog.useModule({ enabled: requested && allowed })?.default;
  const mounted = Boolean(Dialog);

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

    const stopListening = listenForCommandPaletteRequest(() => {
      void paletteDialog.load();
      setRequested(true);
    });

    globalThis.addEventListener("keydown", onKeyDown);

    return () => {
      stopListening();
      globalThis.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted]);

  return Dialog ? <Dialog /> : null;
}
