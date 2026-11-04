"use client";

import { useExtracted } from "next-intl";

/** Each refusal's copy, on its own screen or as why a dropped call can't go on. */
export function useRefusalCopy() {
  const t = useExtracted();

  return {
    callInProgress: {
      text: t(
        "It's open in another tab or on another device. Ending it from here skips its feedback.",
      ),
      title: t("You're already in a call"),
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
    takeover: t({
      description:
        "Another call is still running: this ends it and starts the call on this screen.",
      message: "End that call and start this one",
    }),
  };
}
