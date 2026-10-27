"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { createContext, use, useId, useState } from "react";
import {
  REDUCED_CLASS,
  useDeviceReducesMotion,
  useReducedMotionCss,
} from "../../_components/reduced-motion";

const ReducedContext = createContext(false);

/** Whether the demos show their reduced-motion version, by the switch or the device. */
export function useReducedPreview(): boolean {
  return use(ReducedContext);
}

/**
 * Every demo under it with a switch for its reduced-motion version, and the device's setting
 * honored as it is: a device that asks for less motion sees every demo calm.
 */
export function MotionPreview({ children }: React.PropsWithChildren) {
  const device = useDeviceReducesMotion();
  const css = useReducedMotionCss();
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
