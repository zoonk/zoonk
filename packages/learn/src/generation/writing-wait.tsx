"use client";

import { type ReactNode } from "react";
import { FollowedRun } from "./generation-follower";
import { type GenerationKind } from "./generation-kinds";
import { GenerationWait } from "./generation-wait";

/** A request answered with the run writing what it needs: once written, it's sent again. */
export type ContentWriting = {
  generationId: string;
  onReady: () => void;
  restart: () => Promise<unknown>;
};

/** `hint` says what happens once it's written, so a failed run leaves it out. */
export function WritingWait({
  children,
  className,
  hint,
  kind,
  writing,
}: {
  children?: ReactNode;
  className?: string;
  hint?: string;
  kind: GenerationKind;
  writing: ContentWriting;
}) {
  return (
    <FollowedRun
      generationId={writing.generationId}
      key={writing.generationId}
      kind={kind}
      onReady={writing.onReady}
      restart={writing.restart}
    >
      {(run) => (
        <GenerationWait className={className} kind={kind} run={run}>
          {children}
          {hint && run.status !== "failed" && (
            <p className="text-muted-foreground text-sm">{hint}</p>
          )}
        </GenerationWait>
      )}
    </FollowedRun>
  );
}
