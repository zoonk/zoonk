"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { Kbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import Link from "next/link";

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

export function PrimaryActionLink<T extends string>({
  children,
  className,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  className?: string;
  href: Route<T>;
  shortcut: string;
}) {
  return (
    <Link
      className={cn(buttonVariants({ size: "lg" }), "w-full lg:justify-between", className)}
      href={href}
    >
      {children}
      <PrimaryKbd>{shortcut}</PrimaryKbd>
    </Link>
  );
}

export function SecondaryActionLink<T extends string>({
  children,
  className,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  className?: string;
  href: Route<T>;
  shortcut: string;
}) {
  return (
    <Link
      className={cn(buttonVariants({ variant: "outline" }), "w-full lg:justify-between", className)}
      href={href}
    >
      {children}
      <SecondaryKbd>{shortcut}</SecondaryKbd>
    </Link>
  );
}
