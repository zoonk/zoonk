"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * `onBack`: the connection returns or the tab shows again, the moments a failed save may get
 * through. `onAway`: the tab hides. `onLeave`: the page goes away or the player closes.
 */
export function usePageLifecycle({
  onAway,
  onBack,
  onLeave,
}: {
  onAway?: () => void;
  onBack?: () => void;
  onLeave?: () => void;
}): void {
  const away = useEffectEvent(() => onAway?.());
  const back = useEffectEvent(() => onBack?.());
  const leave = useEffectEvent(() => onLeave?.());

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        back();
      } else {
        away();
      }
    };

    const onOnline = () => {
      if (document.visibilityState === "visible") {
        back();
      }
    };

    const onPageHide = () => leave();

    globalThis.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      globalThis.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      leave();
    };
  }, []);
}
