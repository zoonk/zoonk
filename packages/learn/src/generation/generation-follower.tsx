"use client";

import { type ComponentType, type ReactNode, createContext, use } from "react";
import { type GenerationKind } from "./generation-kinds";
import { type GenerationRun } from "./generation-run";

export type FollowedRunProps = {
  children: (run: GenerationRun) => ReactNode;
  generationId: string | null;
  kind: GenerationKind;
  onReady?: () => void;
  readGenerationId?: () => Promise<string | null>;
  restart: () => Promise<unknown>;
};

const GenerationFollowerContext = createContext<ComponentType<FollowedRunProps> | null>(null);

/** Pass a component defined at module level. */
export function GenerationFollowerProvider({
  children,
  follower,
}: {
  children: ReactNode;
  follower: ComponentType<FollowedRunProps>;
}) {
  return <GenerationFollowerContext value={follower}>{children}</GenerationFollowerContext>;
}

export function FollowedRun(props: FollowedRunProps) {
  const Follower = use(GenerationFollowerContext);

  if (!Follower) {
    throw new Error("FollowedRun must be used within a GenerationFollowerProvider");
  }

  // oxlint-disable-next-line react/static-components -- The host supplies a stable module-level follower through context; nothing is created here.
  return <Follower {...props} />;
}
