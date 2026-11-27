"use client";

import { showErrorToast } from "@zoonk/ui/components/toast";
import { useState } from "react";
import { usePageVisit } from "../_utils/use-page-visit";
import { toggleSave, useTabSaves } from "./tab-saves";

/** What the learner changed on one visit to the page. */
type Touched = { keys: ReadonlySet<string>; visit: number };

const UNTOUCHED: Touched = { keys: new Set(), visit: 0 };

/** `saved` is what the page was served. */
export type SaveState<Target> = { saved: boolean; target: Target };

/**
 * Shows the learner's choice at once, on every page in this tab, and sends it as the state they
 * want ([toggleSave]). A save that fails goes back, and says so if the learner is still on the
 * visit of their last tap. What the server last stored for a save made in this tab wins over what
 * the page was served, a copy the router kept from before the tap included.
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
  const { stored, wanted } = useTabSaves();
  const [touched, setTouched] = useState(UNTOUCHED);
  const { isCurrent, visit } = usePageVisit();

  return {
    isSaved: ({ saved, target }: SaveState<Target>) => {
      const key = keyOf(target);
      return wanted.get(key) ?? stored.get(key) ?? saved;
    },
    /** The learner changed it on this visit, so a list keeps its row until they leave. */
    isTouched: (target: Target) => touched.visit === visit && touched.keys.has(keyOf(target)),
    toggle: ({ saved, target }: SaveState<Target>) => {
      const key = keyOf(target);

      setTouched((earlier) => ({
        keys: new Set(earlier.visit === visit ? earlier.keys : []).add(key),
        visit,
      }));

      toggleSave(key, {
        onFailed: (asked) => {
          if (isCurrent(visit)) {
            showErrorToast(asked ? failed.save : failed.remove);
          }
        },
        onStored: (result) => onSaved?.(target, result),
        send: (asked) => save(target, asked),
        served: saved,
      });
    },
  };
}
