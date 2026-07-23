"use client";

import {
  type PlayerLinkComponentProps,
  type PlayerRoute,
  usePlayerLinkComponent,
} from "./player-context";

type PlayerLinkProps = Omit<PlayerLinkComponentProps, "href"> & { href: PlayerRoute };

/**
 * Keeps player destinations route-typed while using the host app's navigation
 * component. Destinations prefetch unless callers explicitly opt out.
 */
export function PlayerLink({ href, prefetch = true, ...props }: PlayerLinkProps) {
  const LinkComponent = usePlayerLinkComponent();

  return <LinkComponent {...props} href={href} prefetch={prefetch} />;
}
