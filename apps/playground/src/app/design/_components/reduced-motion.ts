"use client";

import { useSyncExternalStore } from "react";
import { readRules, walk } from "./mode-styles";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

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

export function useDeviceReducesMotion(): boolean {
  return useSyncExternalStore(subscribeToDevice, deviceReduces, serverReduces);
}

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

export function useReducedMotionCss(): string {
  return useSyncExternalStore(subscribeToSheet, getReducedCss, getServerCss);
}
