"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { PlusMark } from "../_components/plus-lock";
import { SURFACE_CLASS } from "../_components/surface";
import { LearnLink } from "../learn-link";

/**
 * A card in a conversation (a plan change, a feature offered) as wide as its content needs: the
 * full width of a sheet, never stretched across a wide thread.
 */
export const TUTOR_CARD_WIDTH_CLASS = "w-full max-w-130";

/**
 * The card around a feature the buddy offered: its mark, what it is in a few words, and its button,
 * on the same panel as a plan change, the thread's one kind of card. A feature the learner's plan
 * doesn't include looks the same, marked Plus, with Plus's notice in place of its button
 * (`PlusNotice inset`).
 */
export function OfferCard({
  children,
  description,
  locked = false,
  tile,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  locked?: boolean;
  tile: React.ReactNode;
  title: string;
}) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn(SURFACE_CLASS, TUTOR_CARD_WIDTH_CLASS, "flex flex-col gap-3 p-3")}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-5 shrink-0 items-center">{tile}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1" id={titleId}>
            <span className="text-sm font-medium text-balance">{title}</span>
            {locked && <PlusMark />}
          </h3>
          <p className="text-muted-foreground text-[0.8125rem] text-pretty">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The card's way in: its feature's page. */
export function OfferLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <LearnLink
      className={buttonVariants({ className: "self-start", size: "sm", variant: "outline" })}
      href={href}
    >
      {children}
    </LearnLink>
  );
}

/**
 * The mark of a feature on its card: a kind's dot, or for one that isn't a learning kind (a new
 * goal, statistics, memory) its 16px icon, quiet.
 */
export function OfferTile({
  children,
  className,
}: {
  children: React.ReactNode;
  /** A tint, for a feature whose rows elsewhere have one (pronunciation's). */
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-muted-foreground flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
