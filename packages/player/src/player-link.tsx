"use client";

import { Suspense } from "react";
import {
  type PlayerLinkComponentProps,
  type PlayerRoute,
  usePlayerLinkComponent,
} from "./player-context";

type PlayerLinkProps = Omit<PlayerLinkComponentProps, "href"> & { href: PlayerRoute };

/**
 * Locale-aware links can briefly suspend while resolving the current pathname,
 * so each player link catches that work locally instead of replacing the whole
 * player shell. Ordinary destinations still prefetch unless callers opt out.
 */
export function PlayerLink({ href, prefetch = true, ...props }: PlayerLinkProps) {
  const LinkComponent = usePlayerLinkComponent();

  return (
    <Suspense fallback={null}>
      <LinkComponent {...props} href={href} prefetch={prefetch} />
    </Suspense>
  );
}
