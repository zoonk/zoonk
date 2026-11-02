"use client";

import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type DayMission, type Mission } from "@zoonk/core/sessions/missions";
import { useTransition } from "react";

export type MissionView = Mission | DayMission;

type MissionOpens = NonNullable<MissionView["opens"]>;

/** `openBlock` and `openStep` resolve to whether they opened. Opening never starts AI work. */
export type MissionLinks = {
  askBuddy?: () => void;
  hrefs: {
    areaPractice: (areaId: string) => string;
    buddy: string;
    call: (chapterId: string) => string;
    mistakesPractice: string;
    mockChooser: string;
    pattern: (patternId: string) => string;
    pronunciation: string;
  };
  openBlock: (blockId: string) => Promise<boolean>;
  /**
   * Runs on the learner's tap, never on a render, hover or prefetch, so the host can save the day.
   */
  openPage?: () => void;
  openStep?: (ref: DayBlockRef) => Promise<boolean>;
};

/** A page that picks something when opened (the notebook's practice) isn't prefetched. */
type MissionOpen =
  | { href: string; onOpen?: () => void; prefetch: boolean }
  | { open: () => void; pending: boolean };

function getBlockOpen({
  links,
  opens,
}: {
  links: MissionLinks;
  opens: Extract<MissionOpens, { kind: "block" }>;
}): (() => Promise<boolean>) | null {
  if ("blockId" in opens) {
    return () => links.openBlock(opens.blockId);
  }

  const { openStep } = links;
  return openStep ? () => openStep(opens.ref) : null;
}

export function useMissionOpen({
  links,
  opens,
}: {
  links: MissionLinks;
  opens: MissionOpens | undefined;
}): MissionOpen | null {
  const [pending, startTransition] = useTransition();
  const { askBuddy, hrefs } = links;
  const page = (href: string, prefetch = true) => ({ href, onOpen: links.openPage, prefetch });

  if (!opens) {
    return null;
  }

  switch (opens.kind) {
    case "block": {
      const open = getBlockOpen({ links, opens });

      return open
        ? {
            open: () =>
              startTransition(async () => {
                await open();
              }),
            pending,
          }
        : null;
    }
    case "buddy":
      return askBuddy ? { open: askBuddy, pending: false } : page(hrefs.buddy);
    case "areaPractice":
      return page(hrefs.areaPractice(opens.areaId));
    case "call":
      return page(hrefs.call(opens.chapterId));
    case "mistakesPractice":
      return page(hrefs.mistakesPractice, false);
    case "mockChooser":
      return page(hrefs.mockChooser);
    case "pattern":
      return page(hrefs.pattern(opens.patternId));
    case "pronunciation":
      return page(hrefs.pronunciation);
    default:
      return opens satisfies never;
  }
}
