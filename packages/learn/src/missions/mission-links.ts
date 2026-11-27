"use client";

import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type DayMission, type Mission } from "@zoonk/core/sessions/missions";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";

export type MissionView = Mission | DayMission;

type MissionOpens = NonNullable<MissionView["opens"]>;

/**
 * `openBlock` and `openStep` resolve to false when they couldn't open, and true otherwise, also when
 * the learner left before the answer: a tap they left has nothing to report. Opening never starts AI
 * work.
 */
export type MissionLinks = {
  askBuddy?: () => void;
  hrefs: {
    areaPractice: (areaId: string) => string;
    buddy: string;
    call: (chapterId: string) => string;
    mockChooser: string;
    pronunciation: string;
  };
  openBlock: (blockId: string) => Promise<boolean>;
  /**
   * Runs on the learner's tap, never on a render, hover or prefetch, so the host can save the day.
   */
  openPage?: () => void;
  openStep?: (ref: DayBlockRef) => Promise<boolean>;
};

type MissionOpen =
  | { href: string; onOpen?: () => void }
  | { failed: boolean; open: () => void; pending: boolean };

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
  const [failed, setFailed] = useState(false);
  const { askBuddy, hrefs } = links;
  const page = (href: string) => ({ href, onOpen: links.openPage });

  if (!opens) {
    return null;
  }

  switch (opens.kind) {
    case "block": {
      const open = getBlockOpen({ links, opens });

      return open
        ? {
            failed,
            open: () => {
              setFailed(false);

              startTransition(async () => {
                const { data: opened } = await safeAsync(open);
                setFailed(!opened);
              });
            },
            pending,
          }
        : null;
    }
    case "buddy":
      return askBuddy ? { failed: false, open: askBuddy, pending: false } : page(hrefs.buddy);
    case "areaPractice":
      return page(hrefs.areaPractice(opens.areaId));
    case "call":
      return page(hrefs.call(opens.chapterId));
    case "mockChooser":
      return page(hrefs.mockChooser);
    case "pronunciation":
      return page(hrefs.pronunciation);
    default:
      return opens satisfies never;
  }
}
