"use client";

import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type DayMission, type Mission } from "@zoonk/core/sessions/missions";
import { useTransition } from "react";

/**
 * A mission as the screens draw it: one of a saved day, whose block it opens by id, or one of a day
 * not opened yet, whose step it names by its work (`ref`), since that day has no ids yet.
 */
export type MissionView = Mission | DayMission;

type MissionOpens = NonNullable<MissionView["opens"]>;

/**
 * Where the host opens a mission or a first step, from its chip on Today or its row in the buddy's
 * day, following the target core sends (`opens`): one of today's blocks starts like a row of the
 * day the learner picks (`openBlock` on a saved day, `openStep` on a day not opened yet, resolving
 * to whether it opened), and every other target is a page of its own (`hrefs`). On the buddy's own
 * tab, asking it something is the composer right there (`askBuddy`), not a link to the tab.
 * Opening never starts AI work: a call or a question starts only from the learner's own action on
 * its screen.
 */
export type MissionLinks = {
  askBuddy?: () => void;
  hrefs: {
    /** An area's page, whose "Practice now" adds its practice. */
    areaPractice: (areaId: string) => string;
    buddy: string;
    /** The unit's page, where the learner picks a call. */
    call: (chapterId: string) => string;
    mistakesPractice: string;
    mockChooser: string;
    pattern: (patternId: string) => string;
    pronunciation: string;
  };
  openBlock: (blockId: string) => Promise<boolean>;
  /**
   * Runs as the learner's tap opens a mission's page (never on a render, hover or prefetch): the
   * host saves the day the mission is in, so the activity there doesn't wait for it.
   */
  openPage?: () => void;
  /** Opens the day a mission's step is in, then the step; only a host showing that day has it. */
  openStep?: (ref: DayBlockRef) => Promise<boolean>;
};

/**
 * How a target opens: a page (`href`), prefetched unless opening it picks something (the
 * notebook's practice picks a fresh set), with what its tap runs too (`onOpen`), or an action
 * (`open`), busy until it's on its way so a second tap waits.
 */
type MissionOpen =
  | { href: string; onOpen?: () => void; prefetch: boolean }
  | { open: () => void; pending: boolean };

/** Opens one of the day's blocks: by its id once the day is saved, by its work before that. */
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

/** Where a mission or a first step still to do opens; null for one with nowhere to open. */
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
