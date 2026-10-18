"use client";

import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  type LearnerViewCopy,
  type LearnerViewKind,
  type LearnerViewRead,
  type LearnerViewResponse,
  type LearnerViewStamp,
  pickNewerView,
} from "./learner-view-copies";
import {
  getHeldLearnerView,
  holdLearnerView,
  isForHeldLearner,
  reconcileLearnerView,
  refreshLearnerView,
  subscribeToLearnerViews,
} from "./learner-views";
import { useLearnerSummary } from "./use-learner-summary";

type ShownStamp = LearnerViewStamp & { readAt?: number };

/**
 * Reads the view again whenever its screen is shown and something says the shown copy is old:
 * the learner's revision moved past it, the frame's summary names another day, a deadline passed,
 * or this tab wrote; and, until every write says its revision, when the screen shows a copy older
 * than a few seconds (`show`: it mounted, or the browser's history brought the page back). A hidden
 * tab waits for its next show.
 */
function useReconcile({
  drawsHeld,
  kind,
  onResponse,
  shown,
}: {
  /** The screen draws the newest copy this tab holds (a view), not a state of its own. */
  drawsHeld: boolean;
  kind: LearnerViewKind;
  onResponse: (response: LearnerViewResponse<unknown>) => void;
  shown: ShownStamp | null;
}) {
  useEffect(() => {
    if (!shown) {
      return;
    }

    const reconcile = (show: boolean) =>
      reconcileLearnerView({ drawsHeld, kind, onResponse, show, shown });

    const onChange = () => reconcile(false);
    const onPageShow = () => reconcile(true);
    const unsubscribe = subscribeToLearnerViews(onChange);

    reconcile(true);
    document.addEventListener("visibilitychange", onChange);
    globalThis.addEventListener("pageshow", onPageShow);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onChange);
      globalThis.removeEventListener("pageshow", onPageShow);
    };
  }, [drawsHeld, kind, onResponse, shown]);
}

/**
 * A per-learner view (Today) as the page rendered it (`copy`, the newest one the router held), or
 * a newer copy this tab read since: the screen paints the page's copy at once and reads the view
 * again only when it's shown and old, one small read of that view, never a page refresh that would
 * make every link on screen prefetch again. A copy the router rendered for someone else than the
 * learner the browser holds now (another tab signed in as another learner while it was on its way)
 * is never shown: `shown` is null until the page reads itself again for them. When the view says
 * the page shows another state now (a paused goal, no goal), the page reads itself again once.
 * `refresh` reads the view now, for content that arrives without a learner write (a lesson written
 * meanwhile).
 */
export function useLearnerView<View>({
  copy,
  kind,
}: {
  copy: LearnerViewCopy<View>;
  kind: LearnerViewKind;
}): { refresh: () => Promise<LearnerViewRead>; shown: LearnerViewCopy<View> | null } {
  const router = useRouter();

  // The frame's summary says whose copy may show (this re-renders when it changes), and its
  // revision and day when a copy is old.
  useLearnerSummary();

  const held = useSyncExternalStore(
    subscribeToLearnerViews,
    () => getHeldLearnerView(kind),
    () => null,
  );

  const own = isForHeldLearner(copy.userId) ? copy : null;

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A kind's copies all come from its own route.
  const newer = held as LearnerViewCopy<View> | null;
  const shown = own ? pickNewerView(own, newer) : newer;

  const onResponse = useCallback(
    (response: LearnerViewResponse<unknown>) => {
      if (response.status === "elsewhere") {
        router.refresh();
      }
    },
    [router],
  );

  useEffect(() => {
    if (own) {
      holdLearnerView(kind, own);
    }
  }, [own, kind]);

  useReconcile({ drawsHeld: true, kind, onResponse, shown });

  const refresh = useCallback(() => refreshLearnerView({ kind, onResponse }), [kind, onResponse]);

  return { refresh, shown };
}

/**
 * A page state the view's route doesn't draw (Today's paused goal, no goal yet, a plan being
 * built), read at `stamp`: when it's shown and old, the view is read, and the page reads itself
 * again once the state it shows changed (the goal resumed elsewhere, a goal started in another
 * tab). The same reads keep it fresh as the views it stands beside.
 */
export function useLearnerViewState({
  kind,
  stamp,
  state,
}: {
  kind: LearnerViewKind;
  stamp: LearnerViewStamp;
  state: string;
}): void {
  const router = useRouter();

  // The frame's summary: its revision and its day say when the state is old.
  useLearnerSummary();

  // The state changed, or it stayed while what it shows moved on (a suggested goal answered in
  // another tab leaves "no goal" without it): the read's revision is newer than the page's.
  const onResponse = useCallback(
    (response: LearnerViewResponse<unknown>) => {
      if (
        response.status === "ready" ||
        response.state !== state ||
        (response.revision !== null && BigInt(response.revision) > BigInt(stamp.revision))
      ) {
        router.refresh();
      }
    },
    [router, stamp.revision, state],
  );

  useReconcile({ drawsHeld: false, kind, onResponse, shown: stamp });
}
