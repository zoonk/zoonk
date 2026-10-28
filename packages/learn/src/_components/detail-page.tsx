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

export function DetailLayout({
  aside,
  asideLabel = "",
  bar,
  children,
  className,
  ...props
}: React.ComponentProps<"article"> & {
  aside?: React.ReactNode;
  asideLabel?: string;
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

export function DetailTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-title text-balance", className)} data-slot="detail-title" {...props}>
      {children}
    </h1>
  );
}

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

export function DetailActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 md:shrink-0", className)}
      data-slot="detail-actions"
      {...props}
    />
  );
}

export const DETAIL_PRIMARY_CLASS = cn(
  buttonVariants({ size: "lg" }),
  "min-w-0 flex-1 md:flex-none md:px-5",
);

export const DETAIL_MENU_TRIGGER_CLASS = "size-11 shrink-0";

export function DetailMenu({ children, label }: { children: React.ReactNode; label: string }) {
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

export function useDoneShare() {
  const t = useExtracted();

  return (share: number): string =>
    t("{percent}% done", { percent: String(Math.round(Math.min(Math.max(share, 0), 1) * 100)) });
}

export function DetailAsideSection({
  children,
  className,
  detail,
  title,
  titleId,
}: {
  children: React.ReactNode;
  className?: string;
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

export function DetailProperties({ children }: { children: React.ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>;
}

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
