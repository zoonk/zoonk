import { useLayoutEffect } from "react";

export function useRemovePortal(selector = "[role='dialog']") {
  useLayoutEffect(
    () => () => {
      const el = document.querySelector(selector);

      if (el) {
        el.classList.add("hidden");
      }
    },
    [selector],
  );
}
