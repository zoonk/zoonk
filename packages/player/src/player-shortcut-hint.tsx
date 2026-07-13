"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { toast } from "@zoonk/ui/components/sonner";
import { type PointerEvent, type ReactNode } from "react";
import { getLocalDate } from "./player-date";
import { type PlayerShortcutHint, claimPlayerShortcutHint } from "./player-shortcut-hint-storage";

const SHORTCUT_HINT_TOAST_ID = "player-shortcut-hint";
const SHORTCUT_HINT_DURATION_MS = 10_000;

/**
 * Uses the real pointer that activated a control instead of inferring input
 * from screen size. Hybrid laptops can have both touch and mouse input, so a
 * touch tap must stay quiet even when the viewport also supports a fine pointer.
 */
function isPrimaryMousePointer(event: PointerEvent<HTMLElement>) {
  return event.pointerType === "mouse" && event.button === 0;
}

/**
 * Browser privacy settings can make localStorage unavailable even in a client
 * component. Returning null lets the caller fail closed rather than showing a
 * tip on every click when its daily limit cannot be saved.
 */
function getShortcutHintStorage() {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    return globalThis.window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Gives translated shortcut messages the same compact key treatment without
 * forcing every control to duplicate visual classes around the shared Kbd.
 */
export function renderPlayerShortcutHintKey(children: ReactNode) {
  return <Kbd className="mx-0.5 align-middle">{children}</Kbd>;
}

/**
 * Shows contextual keyboard guidance only after a real mouse click and only
 * after reserving that shortcut's one tip for the learner's local day. A fixed
 * toast ID replaces the previous tip when actions happen quickly, avoiding a
 * stack of instructional messages over the player.
 */
export function showPlayerShortcutHint({
  event,
  hint,
  message,
}: {
  event: PointerEvent<HTMLElement>;
  hint: PlayerShortcutHint;
  message: ReactNode;
}) {
  if (!isPrimaryMousePointer(event)) {
    return;
  }

  const storage = getShortcutHintStorage();

  if (!storage) {
    return;
  }

  const shouldShowHint = claimPlayerShortcutHint({
    hint,
    localDate: getLocalDate(new Date()),
    storage,
  });

  if (!shouldShowHint) {
    return;
  }

  toast(message, {
    duration: SHORTCUT_HINT_DURATION_MS,
    id: SHORTCUT_HINT_TOAST_ID,
    position: "bottom-center",
    style: {
      left: 0,
      marginInline: "auto",
      maxWidth: "calc(100vw - 2rem)",
      right: 0,
      width: "fit-content",
    },
  });
}
