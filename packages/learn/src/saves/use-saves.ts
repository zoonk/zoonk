"use client";

import { showErrorToast } from "@zoonk/ui/components/toast";
import { useRef, useState } from "react";
import { usePageVisit } from "../_utils/use-page-visit";

type States = ReadonlyMap<string, boolean>;

/** What the learner changed on one visit to the page. */
type Touched = { keys: ReadonlySet<string>; visit: number };

const UNTOUCHED: Touched = { keys: new Set(), visit: 0 };

function without(states: States, key: string): States {
  return new Map([...states].filter(([other]) => other !== key));
}

/** `saved` is what the page was served. */
export type SaveState<Target> = { saved: boolean; target: Target };

/**
 * Shows the learner's choice at once and sends it as the state they want, one request at a time
 * for each thing, so quick taps end on the last one. A save that fails goes back and says so.
 * What the server stored wins over what the page was served, a copy the router kept from before
 * the tap included.
 */
export function useSaves<Target>({
  failed,
  keyOf,
  onSaved,
  save,
}: {
  failed: { remove: string; save: string };
  keyOf: (target: Target) => string;
  onSaved?: (target: Target, saved: boolean) => void;
  /** Resolves to whether it's saved now, or null when it couldn't be stored. */
  save: (target: Target, saved: boolean) => Promise<boolean | null>;
}) {
  const [wanted, setWanted] = useState<States>(new Map());
  const [stored, setStored] = useState<States>(new Map());
  const [touched, setTouched] = useState(UNTOUCHED);
  const sending = useRef(new Map<string, boolean>());
  const visit = usePageVisit();

  const settle = (key: string) => {
    sending.current.delete(key);
    setWanted((current) => without(current, key));
  };

  const send = async ({ last, target }: { last: boolean; target: Target }) => {
    const key = keyOf(target);
    const next = sending.current.get(key);

    if (next === undefined || next === last) {
      settle(key);
      return;
    }

    const result = await save(target, next).catch(() => null);

    if (result === null) {
      settle(key);
      showErrorToast(next ? failed.save : failed.remove);
      return;
    }

    setStored((current) => new Map(current).set(key, result));
    onSaved?.(target, result);
    await send({ last: result, target });
  };

  const current = ({ saved, target }: SaveState<Target>) => stored.get(keyOf(target)) ?? saved;

  return {
    isSaved: (state: SaveState<Target>) => wanted.get(keyOf(state.target)) ?? current(state),
    /** The learner changed it on this visit, so a list keeps its row until they leave. */
    isTouched: (target: Target) => touched.visit === visit && touched.keys.has(keyOf(target)),
    toggle: (state: SaveState<Target>) => {
      const key = keyOf(state.target);

      setTouched((earlier) => ({
        keys: new Set(earlier.visit === visit ? earlier.keys : []).add(key),
        visit,
      }));

      const isSending = sending.current.has(key);
      const next = !(sending.current.get(key) ?? current(state));

      sending.current.set(key, next);
      setWanted((states) => new Map(states).set(key, next));

      if (!isSending) {
        void send({ last: current(state), target: state.target });
      }
    },
  };
}
