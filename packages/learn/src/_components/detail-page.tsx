"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { PageWithAside } from "../shell/learn-shell";
import { PAGE_COLUMN_CLASS, PageSection, PageSectionHeader, PageSectionTitle } from "./page";

/**
 * A page opened from a tab (a subject, a chapter, a unit, the exam, the mistakes notebook), as
 * Linear's issue view: its bar (`bar`, the way back), its header (the group it belongs to as a mono
 * eyebrow, its name, a mono line of facts) with its one main action and its "…" beside the name
 * from `md` (under it, the main action full width, on a phone), then its sections flat on the page.
 * Its properties (`aside`: coverage, details, practice) sit in the full-height aside from 72rem,
 * and follow the sections in the same column under it. The bar sits in the page's own column, so
 * from 72rem it ends where the aside begins.
 *
 * ```tsx
 * <DetailLayout
 *   aside={<DetailAsideSection title="Details" titleId="…">…</DetailAsideSection>}
 *   asideLabel="About this chapter"
 *   bar={<LearnPageBar back={{ href: "/plan", label: "Plan" }} title="Circuits" />}
 * >
 *   <DetailAside>
 *     <DetailHero>
 *       <DetailHeroText>
 *         <DetailEyebrow>Chapter 5</DetailEyebrow>
 *         <DetailTitle>Circuits</DetailTitle>
 *         <DetailFacts>4 lessons · 26 min · 50% done</DetailFacts>
 *       </DetailHeroText>
 *       <DetailActions>
 *         <DetailContinueLink href="/learn/1" started />
 *         <DetailMenu label="Chapter options">…menu items…</DetailMenu>
 *       </DetailActions>
 *     </DetailHero>
 *   </DetailAside>
 *   <DetailContent>…sections…</DetailContent>
 * </DetailLayout>
 * ```
 */
export function DetailLayout({
  aside,
  asideLabel = "",
  bar,
  children,
  className,
  ...props
}: React.ComponentProps<"article"> & {
  /** The page's properties, beside its sections from 72rem. */
  aside?: React.ReactNode;
  /** The aside's accessible name. */
  asideLabel?: string;
  /** The page's bar (`LearnPageBar`), over its header. */
  bar?: React.ReactNode;
}) {
  const page = (
    <article className="flex min-w-0 flex-col gap-8" {...props}>
      {bar}
      <div
        className={cn(PAGE_COLUMN_CLASS, "flex flex-col gap-8", className)}
        data-slot="detail-layout"
      >
        {children}
      </div>
    </article>
  );

  if (!aside) {
    return page;
  }

  return (
    <PageWithAside aside={aside} asideLabel={asideLabel}>
      {page}
    </PageWithAside>
  );
}

/** The page's header and what it says first, on top of its sections. */
export function DetailAside({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-5", className)}
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

/**
 * The page's header: the eyebrow, the name and the facts, and its actions (`DetailActions`) beside
 * them from `md`, under them on a phone.
 */
export function DetailHero({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6",
        className,
      )}
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
export { PageEyebrow as DetailEyebrow } from "./page";

export function DetailTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-title text-balance", className)} data-slot="detail-title" {...props}>
      {children}
    </h1>
  );
}

/** A line of facts under the name, separated by dots, in the mono face as every number is. */
export function DetailFacts({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-1.5 pt-1 font-mono text-xs tabular-nums",
        className,
      )}
      data-slot="detail-facts"
      {...props}
    />
  );
}

/** The main action, then the page's other actions (its "…"), at the end of the title's row. */
export function DetailActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 md:shrink-0", className)}
      data-slot="detail-actions"
      {...props}
    />
  );
}

/**
 * A detail page's main action: the primary button at its 44px, as wide as the row beside the
 * page's "…" on a phone, as wide as its words from `md`, for one that's a link or a button.
 */
export const DETAIL_PRIMARY_CLASS = cn(
  buttonVariants({ size: "lg" }),
  "min-w-0 flex-1 md:flex-none md:px-5",
);

/** The "…" beside a detail page's main action (an `icon` button), as tall as it. */
export const DETAIL_MENU_TRIGGER_CLASS = "size-11 shrink-0";

/**
 * The page's other actions beside its main one: an outline "…" the height of the main action,
 * opening a menu of `children` (`DropdownMenuItem`s, or `ReportProblemItem`).
 */
export function DetailMenu({
  children,
  label,
}: {
  children: React.ReactNode;
  /** Names the button for screen readers ("Chapter options"). */
  label: string;
}) {
  return (
    <DropdownMenu>
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
 * "Continue" (or "Start"): the page's way in, which Enter follows from anywhere on the page, its
 * ⏎ shown on devices with a keyboard at hand. How far the learner is sits in the facts line, never
 * inside the button.
 */
export function DetailContinueLink({
  href,
  lessonWritten,
  started,
}: {
  href: string;
  lessonWritten?: boolean;
  started: boolean;
}) {
  const t = useExtracted();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={DETAIL_PRIMARY_CLASS}
      href={href}
      lessonWritten={lessonWritten}
      prefetch={lessonWritten === false ? "auto" : true}
      ref={ref}
    >
      {started ? t("Continue") : t("Start")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

/** "33% done": how far the learner is in a page's lessons or topics, for its facts line. */
export function useDoneShare() {
  const t = useExtracted();

  return (share: number): string =>
    t("{percent}% done", { percent: String(Math.round(Math.min(Math.max(share, 0), 1) * 100)) });
}

/**
 * A block of the aside: its label, then its content (a page's coverage, its properties, more to
 * do). Under 72rem it follows the sections as one of them.
 */
export function DetailAsideSection({
  children,
  className,
  detail,
  title,
  titleId,
}: {
  children: React.ReactNode;
  className?: string;
  /** A quiet count beside the label ("180 q"). */
  detail?: React.ReactNode;
  title: string;
  titleId: string;
}) {
  return (
    <PageSection aria-labelledby={titleId} className={cn("gap-2.5", className)}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{title}</PageSectionTitle>
        {detail && (
          <span className="text-muted-foreground font-mono text-xs tabular-nums">{detail}</span>
        )}
      </PageSectionHeader>
      {children}
    </PageSection>
  );
}

/** A page's properties, one row each (see `DetailProperty`). */
export function DetailProperties({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>;
}

/**
 * One property, Linear's way: its name muted on the left, its value on the right (`mono` for a
 * number or a date).
 */
export function DetailProperty({
  children,
  label,
  mono = false,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-8.5 items-center justify-between gap-3 text-[0.8125rem]">
      <dt className="text-muted-foreground min-w-0 truncate">{label}</dt>
      <dd className={cn("min-w-0 text-right", mono && "font-mono tabular-nums")}>{children}</dd>
    </div>
  );
}
