"use client";

import Link from "next/link";
import { type ComponentProps } from "react";
import { type PlayerRoute } from "./player-context";

type PlayerLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: PlayerRoute;
};

export function PlayerLink({ href, ...props }: PlayerLinkProps) {
  // Concrete route validation happens in the consuming app before href values
  // cross into the shared player package.
  return <Link prefetch {...props} href={href as ComponentProps<typeof Link>["href"]} />;
}
