"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageWithAside } from "../shell/learn-shell";
import { EnterLink } from "./enter-button";
import { PAGE_COLUMN_CLASS, PageSection, PageSectionHeader, PageSectionTitle } from "./page";

/** A page under its bar: the bar's title and the page's sit closer on a phone. */
export const PAGE_ARTICLE_CLASS = "flex min-w-0 flex-col gap-2 sm:gap-8";

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
    <article className={PAGE_ARTICLE_CLASS} {...props}>
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

export const DETAIL_PRIMARY_CLASS = cn(
  buttonVariants({ size: "lg" }),
  "min-w-0 flex-1 lg:flex-none lg:px-5",
);

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

  return (
    <EnterLink
      className={DETAIL_PRIMARY_CLASS}
      href={href}
      lessonWritten={lessonWritten}
      prefetch={lessonWritten === false ? "auto" : true}
      size="lg"
    >
      {started ? t("Continue") : t("Start")}
    </EnterLink>
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
    <div className="text-compact flex min-h-8.5 items-center justify-between gap-3">
      <dt className="text-muted-foreground min-w-0 truncate">{label}</dt>
      <dd className={cn("min-w-0 text-right", mono && "font-mono tabular-nums")}>{children}</dd>
    </div>
  );
}
