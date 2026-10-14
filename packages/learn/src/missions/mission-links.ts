"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { useTransition } from "react";

type MissionOpens = NonNullable<Mission["opens"]>;

/**
 * Where the host opens a mission or a first step, from its chip on Today or its row in the buddy's
 * day, following the target core sends (`opens`): one of today's blocks starts like a row of the
 * day the learner picks (`openBlock`, resolving to whether it opened), and every other target is a
 * page of its own (`hrefs`). On the buddy's own tab, asking it something is the composer right
 * there (`askBuddy`), not a link to the tab. Opening never starts AI work: a call or a question
 * starts only from the learner's own action on its screen.
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
};

/**
 * How a target opens: a page (`href`), prefetched unless opening it picks something (the
 * notebook's practice picks a fresh set), or an action (`open`), busy until it's on its way so a
 * second tap waits.
 */
type MissionOpen = { href: string; prefetch: boolean } | { open: () => void; pending: boolean };

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

  if (!opens) {
    return null;
  }

  switch (opens.kind) {
    case "block":
      return {
        open: () =>
          startTransition(async () => {
            await links.openBlock(opens.blockId);
          }),
        pending,
      };
    case "buddy":
      return askBuddy ? { open: askBuddy, pending: false } : { href: hrefs.buddy, prefetch: true };
    case "areaPractice":
      return { href: hrefs.areaPractice(opens.areaId), prefetch: true };
    case "call":
      return { href: hrefs.call(opens.chapterId), prefetch: true };
    case "mistakesPractice":
      return { href: hrefs.mistakesPractice, prefetch: false };
    case "mockChooser":
      return { href: hrefs.mockChooser, prefetch: true };
    case "pattern":
      return { href: hrefs.pattern(opens.patternId), prefetch: true };
    case "pronunciation":
      return { href: hrefs.pronunciation, prefetch: true };
    default:
      return opens satisfies never;
  }
}
