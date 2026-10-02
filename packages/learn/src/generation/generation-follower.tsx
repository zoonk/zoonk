"use client";

import { type ComponentType, type ReactNode, createContext, use } from "react";
import { type GenerationKind } from "./generation-kinds";
import { type GenerationRun } from "./generation-run";

/** What a host needs to follow a run: which wait it's for, the run, and how to start it again. */
export type FollowedRunProps = {
  children: (run: GenerationRun) => ReactNode;
  generationId: string | null;
  kind: GenerationKind;
  /** Runs once the wait's content is ready, to move on by itself. */
  onReady?: () => void;
  /** Asks the server for the run's id while the host doesn't have it yet. */
  readGenerationId?: () => Promise<string | null>;
  /** Starts the run again when the learner asks (a POST); may return the new run's id. */
  restart: () => Promise<unknown>;
};

const GenerationFollowerContext = createContext<ComponentType<FollowedRunProps> | null>(null);

/**
 * Gives screens the host's way of following a generation run (main streams it from the API), so
 * a screen that only learns the run's id itself (a draft, a level test) can still follow it.
 * Pass a component defined at module level.
 */
export function GenerationFollowerProvider({
  children,
  follower,
}: {
  children: ReactNode;
  follower: ComponentType<FollowedRunProps>;
}) {
  return <GenerationFollowerContext value={follower}>{children}</GenerationFollowerContext>;
}

/**
 * Follows a run through the host's follower and renders `children` with it, usually a
 * `GenerationWait`: `<FollowedRun kind="understanding" …>{(run) => <GenerationWait … />}</FollowedRun>`.
 */
export function FollowedRun(props: FollowedRunProps) {
  const Follower = use(GenerationFollowerContext);

  if (!Follower) {
    throw new Error("FollowedRun must be used within a GenerationFollowerProvider");
  }

  // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level follower through context; nothing is created here.
  return <Follower {...props} />;
}
