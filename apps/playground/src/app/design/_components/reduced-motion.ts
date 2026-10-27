"use client";

import { useSyncExternalStore } from "react";
import { readRules, walk } from "./mode-styles";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** The class that draws what's inside it as `prefers-reduced-motion: reduce` does. */
export const REDUCED_CLASS = "ds-motion-reduce";

function subscribeToDevice(onChange: () => void): () => void {
  const media = globalThis.matchMedia(REDUCE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function deviceReduces(): boolean {
  return globalThis.matchMedia(REDUCE_QUERY).matches;
}

function serverReduces(): boolean {
  return false;
}

/** Whether this device asks for less motion. */
export function useDeviceReducesMotion(): boolean {
  return useSyncExternalStore(subscribeToDevice, deviceReduces, serverReduces);
}

/**
 * The reduced-motion class, copied from what `globals.css` declares on `:root` under
 * `prefers-reduced-motion: reduce`, so a switch shows exactly what such a device gets.
 */
function buildReducedCss(): string {
  const declarations: string[] = [];

  for (const sheet of document.styleSheets) {
    const rules = readRules(sheet);

    if (rules) {
      walk(rules, [], (scope, style, conditions) => {
        if (scope === "root" && conditions.some((text) => /reduced-motion:\s*reduce/u.test(text))) {
          for (const property of style) {
            if (property.startsWith("--")) {
              declarations.push(`${property}: ${style.getPropertyValue(property).trim()};`);
            }
          }
        }
      });
    }
  }

  return `.${REDUCED_CLASS} { ${declarations.join(" ")} }`;
}

let reducedCss: string | null = null;

function stopListening(): void {
  // Nothing was listened to: the stylesheet stays as it loaded while the page is open.
}

function subscribeToSheet(): () => void {
  return stopListening;
}

function getReducedCss(): string {
  reducedCss ??= buildReducedCss();
  return reducedCss;
}

function getServerCss(): string {
  return "";
}

/** The rules `REDUCED_CLASS` needs, empty on the server. */
export function useReducedMotionCss(): string {
  return useSyncExternalStore(subscribeToSheet, getReducedCss, getServerCss);
}
