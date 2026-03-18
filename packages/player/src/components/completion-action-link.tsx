"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";

export function PrimaryKbd({ children }: { children: React.ReactNode }) {
  return (
    <Kbd className="bg-primary-foreground/15 text-primary-foreground hidden opacity-70 lg:inline-flex">
      {children}
    </Kbd>
  );
}

export function SecondaryKbd({ children }: { children: React.ReactNode }) {
  return <Kbd className="hidden opacity-60 lg:inline-flex">{children}</Kbd>;
}

export function PrimaryActionLink({
  children,
  className,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  className?: string;
  href: PlayerRoute;
  shortcut: string;
}) {
  return (
    <PlayerLink
      className={cn(buttonVariants({ size: "lg" }), "w-full lg:justify-between", className)}
      href={href}
    >
      {children}
      <PrimaryKbd>{shortcut}</PrimaryKbd>
    </PlayerLink>
  );
}

export function SecondaryActionLink({
  children,
  className,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  className?: string;
  href: PlayerRoute;
  shortcut: string;
}) {
  return (
    <PlayerLink
      className={cn(buttonVariants({ variant: "outline" }), "w-full lg:justify-between", className)}
      href={href}
    >
      {children}
      <SecondaryKbd>{shortcut}</SecondaryKbd>
    </PlayerLink>
  );
}
