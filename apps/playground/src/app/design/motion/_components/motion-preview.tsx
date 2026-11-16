"use client";

import { Switch } from "@zoonk/ui/components/switch";
import { createContext, use, useId, useState } from "react";
import {
  REDUCED_CLASS,
  useDeviceReducesMotion,
  useReducedMotionCss,
} from "../../_components/reduced-motion";

const ReducedContext = createContext(false);

export function useReducedPreview(): boolean {
  return use(ReducedContext);
}

export function MotionPreview({ children }: React.PropsWithChildren) {
  const device = useDeviceReducesMotion();
  const css = useReducedMotionCss();
  const [switched, setSwitched] = useState(false);
  const switchId = useId();
  const reduced = device || switched;

  return (
    <ReducedContext value={reduced}>
      {css && <style>{css}</style>}

      <div className="bg-background/90 supports-backdrop-filter:bg-background/75 sticky top-0 z-10 mb-8 flex items-start gap-x-3 gap-y-1 border-b py-3 backdrop-blur-md">
        <Switch checked={reduced} disabled={device} id={switchId} onCheckedChange={setSwitched} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label className="text-sm font-medium" htmlFor={switchId}>
            Reduced motion
          </label>
          <span className="text-muted-foreground text-sm">
            {device
              ? "This device asks for less motion, so every demo shows its calm version."
              : "Shows every demo as it looks when a device asks for less motion."}
          </span>
        </div>
      </div>

      <div className={switched ? REDUCED_CLASS : undefined}>{children}</div>
    </ReducedContext>
  );
}
