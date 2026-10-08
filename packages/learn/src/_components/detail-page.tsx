"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { WIDE_PAGE_CLASS } from "../shell/learn-shell";

/**
 * A page opened from a tab (a subject, a chapter, a unit, the exam): its identity first (a tile,
 * the group it belongs to, its name and a line of facts), one main action right under it with the
 * page's other actions beside it, then its sections. From `lg` the identity and the action stay in
 * a column on the left while the sections scroll on the right, as main's course pages do.
 *
 * ```tsx
 * <DetailLayout>
 *   <DetailAside>
 *     <DetailHero>
 *       <KindTile kind="lesson" size="lg" />
 *       <DetailHeroText>
 *         <DetailEyebrow>Chapter 5</DetailEyebrow>
 *         <DetailTitle>Circuits</DetailTitle>
 *         <DetailFacts>4 lessons</DetailFacts>
 *       </DetailHeroText>
 *     </DetailHero>
 *     <DetailActions>
 *       <DetailContinueLink href="/learn/1" share={0.5} started />
 *       <DetailMenu label="Chapter options">…menu items…</DetailMenu>
 *     </DetailActions>
 *   </DetailAside>
 *   <DetailContent>…sections…</DetailContent>
 * </DetailLayout>
 * ```
 */
export function DetailLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-14",
        WIDE_PAGE_CLASS,
        className,
      )}
      data-slot="detail-layout"
      {...props}
    />
  );
}

/** The identity column: the hero and its actions, in sight while the sections scroll from `lg`. */
export function DetailAside({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-5 lg:sticky lg:top-24", className)}
      data-slot="detail-aside"
      {...props}
    />
  );
}

export function DetailContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-8", className)}
      data-slot="detail-content"
      {...props}
    />
  );
}

/** The page's tile beside its name on phones, above it from `lg`. */
export function DetailHero({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-start gap-4 lg:flex-col lg:gap-5", className)}
      data-slot="detail-hero"
      {...props}
    />
  );
}

export function DetailHeroText({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1", className)}
      data-slot="detail-hero-text"
      {...props}
    />
  );
}

/** What the page belongs to: "Chapter 5", the notice's group, the unit's level. */
export function DetailEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm font-medium", className)}
      data-slot="detail-eyebrow"
      {...props}
    />
  );
}

export function DetailTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-[1.75rem] leading-tight font-bold tracking-tight text-balance lg:text-3xl",
        className,
      )}
      data-slot="detail-title"
      {...props}
    >
      {children}
    </h1>
  );
}

/** A line of facts under the name, separated by dots. */
export function DetailFacts({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-1.5 pt-1 text-sm",
        className,
      )}
      data-slot="detail-facts"
      {...props}
    />
  );
}

/** The main action, then the page's other actions (an icon button, its "…"). */
export function DetailActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-slot="detail-actions"
      {...props}
    />
  );
}

/**
 * A detail page's main action, exactly as main's course pages draw their Continue (the default
 * button filling the row), for one that's a button rather than a link.
 */
export const DETAIL_PRIMARY_CLASS = cn(buttonVariants(), "min-w-0 flex-1 gap-2");

/** The "…" beside a detail page's main action (an `icon` button), as tall as it. */
export const DETAIL_MENU_TRIGGER_CLASS = "shrink-0";

/**
 * The page's other actions beside its main one, as main's course pages have them: an outline "…"
 * the height of the main action, opening a menu of `children` (`DropdownMenuItem`s, or
 * `ContentVoteMenuItems`). `onOpenChange` lets a screen pause its keys while the menu is open.
 */
export function DetailMenu({
  children,
  label,
  onOpenChange,
}: {
  children: React.ReactNode;
  /** Names the button for screen readers ("Chapter options"). */
  label: string;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<Button className={DETAIL_MENU_TRIGGER_CLASS} size="icon" variant="outline" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The main action's words exactly as main's course pages write them: the label, then how far the
 * learner is in small muted numbers (the whole phrase for screen readers), or a chevron when
 * there's no progress to tell.
 */
export function DetailPrimaryLabel({ label, share }: { label: string; share?: number | null }) {
  const t = useExtracted();

  if (share === undefined || share === null) {
    return (
      <span className="inline-flex min-w-0 items-center justify-center gap-1.5">
        {label}
        <ChevronRightIcon aria-hidden="true" />
      </span>
    );
  }

  const percent = String(Math.round(Math.min(Math.max(share, 0), 1) * 100));

  return (
    <span className="inline-flex min-w-0 items-baseline justify-center gap-1.5 leading-none">
      <span className="min-w-0 truncate leading-none">{label}</span>
      <span
        aria-hidden="true"
        className="text-primary-foreground/65 text-[0.7rem] leading-none font-medium tabular-nums"
      >
        {`${percent}%`}
      </span>
      <span className="sr-only">{t("{percent}% complete", { percent })}</span>
    </span>
  );
}

/**
 * "Continue 32%" (or "Start 0%"): the page's way in, with how far the learner is in it beside the
 * label, as main's course pages say it, instead of a separate bar.
 */
export function DetailContinueLink({
  href,
  share,
  started,
}: {
  href: string;
  /** How much of the page's lessons or topics is done, between 0 and 1. */
  share: number;
  started: boolean;
}) {
  const t = useExtracted();

  return (
    <LearnLink className={DETAIL_PRIMARY_CLASS} href={href}>
      <DetailPrimaryLabel label={started ? t("Continue") : t("Start")} share={share} />
    </LearnLink>
  );
}
