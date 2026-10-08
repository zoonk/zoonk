import { cn } from "@zoonk/ui/lib/utils";

/**
 * The page templates' building blocks, one source for every page's structure: a page opens with
 * its large title (`PageHeader`) and holds its content in sections, each named by a bold header
 * (`PageSection`), so a learner always sees where they are and what's on the page.
 *
 * ```tsx
 * <Page>
 *   <PageHeader>
 *     <PageHeaderContent>
 *       <PageEyebrow>Wednesday, October 7</PageEyebrow>
 *       <PageTitle>Today</PageTitle>
 *       <PageSubtitle>34 days left</PageSubtitle>
 *     </PageHeaderContent>
 *   </PageHeader>
 *
 *   <PageSection aria-labelledby="session-title">
 *     <PageSectionHeader>
 *       <PageSectionTitle id="session-title">Today's session</PageSectionTitle>
 *       <PageSectionDetail>7 lessons</PageSectionDetail>
 *     </PageSectionHeader>
 *     …
 *     <PageSectionFooter>Where the numbers come from.</PageSectionFooter>
 *   </PageSection>
 * </Page>
 * ```
 */
export function Page({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-8", className)} data-slot="page" {...props} />;
}

/** A tab's, a section's or a settings page's large title, with one control beside it at most. */
export function PageHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-end justify-between gap-4 px-1", className)}
      data-slot="page-header"
      {...props}
    />
  );
}

export function PageHeaderContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1", className)}
      data-slot="page-header-content"
      {...props}
    />
  );
}

/** The context above the title: the date, the goal and its day. */
export function PageEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-[0.8125rem] font-semibold tracking-wide uppercase",
        className,
      )}
      data-slot="page-eyebrow"
      {...props}
    />
  );
}

/** The page's name: the tab, the section or the setting the learner is on. */
export function PageTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-[2.125rem] leading-[1.1] font-bold tracking-tight text-balance",
        className,
      )}
      data-slot="page-title"
      {...props}
    >
      {children}
    </h1>
  );
}

/** One supporting line under the title, its facts side by side. */
export function PageSubtitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[0.9375rem]",
        className,
      )}
      data-slot="page-subtitle"
      {...props}
    />
  );
}

/** A block of the page under its own header. */
export function PageSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex min-w-0 flex-col gap-3", className)}
      data-slot="page-section"
      {...props}
    />
  );
}

/** The section's title with its count or one action on the same line. */
export function PageSectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-7 items-center justify-between gap-3 px-1", className)}
      data-slot="page-section-header"
      {...props}
    />
  );
}

export function PageSectionTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("min-w-0 text-xl font-bold tracking-tight text-balance", className)}
      data-slot="page-section-title"
      {...props}
    >
      {children}
    </h2>
  );
}

/** A quiet count or state beside the title ("7 lessons", "3 of 9"). */
export function PageSectionDetail({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground shrink-0 text-sm tabular-nums", className)}
      data-slot="page-section-detail"
      {...props}
    />
  );
}

/** A group's name inside a section ("Objective tests", "Physics"), over its list. */
export function PageSectionLabel({ children, className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "text-muted-foreground -mb-1 px-4 pt-1 text-[0.8125rem] font-medium",
        className,
      )}
      data-slot="page-section-label"
      {...props}
    >
      {children}
    </h3>
  );
}

/** A note under the section's content: where its numbers come from, or the rule it follows. */
export function PageSectionFooter({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground px-4 text-[0.8125rem] leading-snug [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
      data-slot="page-section-footer"
      {...props}
    />
  );
}
