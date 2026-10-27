"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { createContext, use, useId, useState, useSyncExternalStore } from "react";
import { readRules, walk } from "../../_components/mode-styles";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** The class that draws what's inside it as `prefers-reduced-motion: reduce` does. */
const REDUCED_CLASS = "ds-motion-reduce";

const ReducedContext = createContext(false);

/** Whether the demos show their reduced-motion version, by the switch or the device. */
export function useReducedPreview(): boolean {
  return use(ReducedContext);
}

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

/**
 * The reduced-motion class, copied from what `globals.css` declares on `:root` under
 * `prefers-reduced-motion: reduce`, so the switch shows exactly what such a device gets.
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

/**
 * Every demo under it with a switch for its reduced-motion version, and the device's setting
 * honored as it is: a device that asks for less motion sees every demo calm.
 */
export function MotionPreview({ children }: React.PropsWithChildren) {
  const device = useSyncExternalStore(subscribeToDevice, deviceReduces, serverReduces);
  const css = useSyncExternalStore(subscribeToSheet, getReducedCss, getServerCss);
  const [switched, setSwitched] = useState(false);
  const switchId = useId();
  const reduced = device || switched;

  return (
    <ReducedContext value={reduced}>
      {css && <style>{css}</style>}

      <div className="bg-background/90 supports-backdrop-filter:bg-background/75 sticky top-0 z-10 mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-3 backdrop-blur-md">
        <Switch checked={reduced} disabled={device} id={switchId} onCheckedChange={setSwitched} />
        <label className="text-sm font-medium" htmlFor={switchId}>
          Reduced motion
        </label>
        <span className="text-muted-foreground text-sm">
          {device
            ? "This device asks for less motion, so every demo shows its calm version."
            : "Shows every demo as a device that asks for less motion sees it."}
        </span>
      </div>

      <div className={switched ? REDUCED_CLASS : undefined}>{children}</div>
    </ReducedContext>
  );
}
