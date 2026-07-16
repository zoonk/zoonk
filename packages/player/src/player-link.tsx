"use client";

import {
  type PlayerLinkComponentProps,
  type PlayerRoute,
  usePlayerLinkComponent,
} from "./player-context";

type PlayerLinkProps = Omit<PlayerLinkComponentProps, "href" | "prefetch"> & { href: PlayerRoute };

export function PlayerLink({ href, ...props }: PlayerLinkProps) {
  const LinkComponent = usePlayerLinkComponent();

  return <LinkComponent prefetch {...props} href={href} />;
}
