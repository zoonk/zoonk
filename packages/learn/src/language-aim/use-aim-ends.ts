"use client";

import { type LanguageAim } from "@zoonk/core/language/aims";
import { safeAsync } from "@zoonk/utils/error";
import { useRef, useState } from "react";

type AimEnds = { ends: Partial<Record<LanguageAim, string | null>>; request: number };

/**
 * When each aim would be reached, read from the planner as picking that aim would lay the plan out
 * (`read`, null when it has no date). Asked only while the choices show, since each one plans the
 * goal again; an answer to an earlier ask is dropped.
 */
export function useAimEnds(read: (aim: LanguageAim) => Promise<string | null>) {
  const [state, setState] = useState<AimEnds>({ ends: {}, request: 0 });
  const last = useRef(0);

  const ask = (aims: readonly LanguageAim[]) => {
    last.current += 1;
    const request = last.current;
    setState({ ends: {}, request });

    for (const aim of aims) {
      void safeAsync(() => read(aim)).then(({ data }) => {
        setState((current) =>
          current.request === request
            ? { ...current, ends: { ...current.ends, [aim]: data ?? null } }
            : current,
        );
      });
    }
  };

  return { ask, ends: state.ends };
}
