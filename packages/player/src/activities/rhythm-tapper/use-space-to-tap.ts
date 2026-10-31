"use client";

import { useKeyboardCallback } from "@zoonk/ui/hooks/keyboard";
import { usePlayerInteractionState } from "../../player-context";

const SPACE_CONTROLS =
  "button, a[href], summary, [role='button'], [role='radio'], [role='checkbox'], [role='switch'], [role='tab'], [role='slider']";

export function useSpaceToTap({
  enabled,
  onTap,
}: {
  enabled: boolean;
  onTap: (timeMs: number) => void;
}) {
  const interaction = usePlayerInteractionState();

  useKeyboardCallback(
    " ",
    (event) => {
      if (!enabled || interaction === "paused") {
        return false;
      }

      const element = event.target instanceof Element ? event.target : document.activeElement;
      const pad = element?.closest("[data-slot='rhythm-tap-pad']");

      if (!pad && element?.closest(SPACE_CONTROLS)) {
        return false;
      }

      onTap(event.timeStamp);
    },
    { mode: "none", screen: true },
  );
}
