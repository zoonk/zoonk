"use client";

import { useExtracted } from "next-intl";

/** Each refusal's copy, on its own screen or as why a dropped call can't go on. */
export function useRefusalCopy() {
  const t = useExtracted();

  return {
    callInProgress: {
      text: t(
        "It's open in another tab or on another device. Starting this one ends it, without its feedback.",
      ),
      title: t("You're in another call"),
    },
    callsPaused: {
      text: t({
        description:
          'Under the title "Calls are paused": the pause applies to every learner, not only this one.',
        message: "It's the same for everyone right now. Try again later.",
      }),
      title: t("Calls are paused"),
    },
    ended: { text: t("Start a new call to keep practicing."), title: t("This call has ended") },
    takeover: t("Start this call"),
  };
}
