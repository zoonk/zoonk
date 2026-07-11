"use client";

import Link from "next/link";
import { type ComponentProps } from "react";
import { type PlayerRoute } from "./player-context";

type PlayerLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: PlayerRoute };

export function PlayerLink({ href, ...props }: PlayerLinkProps) {
  // Concrete route validation happens in the consuming app before href values
  // cross into the shared player package.
  // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- standalone package types cannot see the consuming app's generated Route union
  return <Link prefetch {...props} href={href as ComponentProps<typeof Link>["href"]} />;
}
