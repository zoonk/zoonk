"use client";

import { type ReactNode, type Ref, createContext, useContext } from "react";

type PlayerLinkComponentProps = {
  "aria-keyshortcuts"?: string;
  children: ReactNode;
  className?: string;
  href: string;
  prefetch?: boolean;
  ref?: Ref<HTMLAnchorElement>;
};

export type PlayerLinkComponent = (props: PlayerLinkComponentProps) => ReactNode;

type PlayerInteractionState = "active" | "paused";

const PlayerInteractionContext = createContext<PlayerInteractionState>("active");

/** While the tutor or a sheet is open over a step, its option keys pause. */
export function usePlayerInteractionState(): PlayerInteractionState {
  return useContext(PlayerInteractionContext);
}

export { PlayerInteractionContext };
