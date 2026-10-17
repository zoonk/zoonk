"use client";

import { noteWitness } from "@/lib/learner/learner-identity";
import { toScriptJson } from "@/lib/learner/script-json";
import { useLayoutEffect } from "react";

/**
 * Reports the tag a private boundary was rendered for (`LearnerWitness`). Its inline script
 * reports while the document is still parsing, so a boundary drawn for someone the browser
 * doesn't hold now is covered before it paints, even in a late streamed chunk. The layout effect
 * reports what the browser renders itself (a client navigation) and a page the router shows again.
 */
export function LearnerWitnessMark({ tag }: { tag: string }) {
  useLayoutEffect(() => {
    noteWitness(tag);
  }, [tag]);

  return (
    <script
      // oxlint-disable-next-line react/no-danger -- Must run as the document parses, before the boundary paints.
      dangerouslySetInnerHTML={{
        __html: `globalThis.zoonkIdentityCover?.witness(${toScriptJson(tag)})`,
      }}
    />
  );
}
