import { cn } from "@zoonk/ui/lib/utils";

export const PAGE_COLUMN_CLASS = "w-full min-w-0";

/** The list (20rem), the gap and the pane's inset (4rem), its hairline (1px), then an entry at the column's measure. */
export const INBOX_PAGE_CLASS = "lg:max-w-[calc(24rem+1px+var(--container-column))]";

export function Page({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(PAGE_COLUMN_CLASS, "flex flex-col gap-7", className)}
      data-slot="page"
      {...props}
    />
  );
}

export function PageHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-end justify-between gap-4", className)}
      data-slot="page-header"
      {...props}
    />
  );
}

export function PageHeaderContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 not-has-[>[data-slot=page-eyebrow]]:pt-5",
        className,
      )}
      data-slot="page-header-content"
      {...props}
    />
  );
}

export function PageEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-faint font-mono text-xs leading-4 uppercase max-sm:text-[0.71875rem]",
        className,
      )}
      data-slot="page-eyebrow"
      {...props}
    />
  );
}

export function PageTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-title", className)} data-slot="page-title" {...props}>
      {children}
    </h1>
  );
}

export function PageSubtitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm",
        className,
      )}
      data-slot="page-subtitle"
      {...props}
    />
  );
}

export function PageSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex min-w-0 flex-col gap-3", className)}
      data-slot="page-section"
      {...props}
    />
  );
}

export function PageSectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-0.5",
        className,
      )}
      data-slot="page-section-header"
      {...props}
    />
  );
}

export const PAGE_SECTION_TITLE_CLASS =
  "min-w-0 text-sm leading-5 font-semibold tracking-[-0.01em] text-balance";

export function PageSectionTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(PAGE_SECTION_TITLE_CLASS, className)}
      data-slot="page-section-title"
      {...props}
    >
      {children}
    </h2>
  );
}

export function PageSectionDetail({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground min-w-0 font-mono text-xs tabular-nums", className)}
      data-slot="page-section-detail"
      {...props}
    />
  );
}

export function PageSectionLabel({ children, className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-muted-foreground -mb-1 pt-1 text-[0.8125rem] font-medium", className)}
      data-slot="page-section-label"
      {...props}
    >
      {children}
    </h3>
  );
}

export function PageSectionFooter({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-[0.8125rem] leading-snug [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
      data-slot="page-section-footer"
      {...props}
    />
  );
}
