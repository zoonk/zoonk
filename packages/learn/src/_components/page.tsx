import { cn } from "@zoonk/ui/lib/utils";

/**
 * A page's column: from the frame's left edge (40px from the sidebar from `lg`) across the whole
 * room beside the sidebar, or up to the aside on a page with one, as app shells with a sidebar lay
 * out their pages (Apple's web apps, Khan Academy, Linear). A wide screen gives the page more room,
 * never a wider margin: grids gain columns, rows and charts grow, and what has to stay readable
 * (prose, a form, a conversation) keeps its measure on the same left edge. Every page's container
 * takes it (`Page`, `DetailLayout`, a section), so every title, tab row and section starts at one
 * place on every page.
 */
export const PAGE_COLUMN_CLASS = "w-full min-w-0";

/**
 * An inbox page's width from `lg` (the mistakes notebook): its list (20rem), the gap and the pane's
 * hairline and inset (4rem and 1px), then an entry at the column's measure. The whole page, its
 * header included, ends with the entries, so its main action lines up with them rather than with
 * the screen's edge, which on a wide screen sat far past the last word.
 */
export const INBOX_PAGE_CLASS = "lg:max-w-[calc(24rem+1px+var(--container-column))]";

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
  return (
    <div
      className={cn(PAGE_COLUMN_CLASS, "flex flex-col gap-7", className)}
      data-slot="page"
      {...props}
    />
  );
}

/** A tab's, a section's or a settings page's large title, with one control beside it at most. */
export function PageHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex items-end justify-between gap-4", className)}
      data-slot="page-header"
      {...props}
    />
  );
}

/**
 * The title's column. A page with nothing to say over its title keeps the eyebrow's line empty,
 * so every page's title sits at the same height and moving between pages never moves it.
 */
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

/**
 * The context above the title (the date, the goal and its day): the quietest line on the page, in
 * the mono face.
 */
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

/** The page's name: the tab, the section or the setting the learner is on. */
export function PageTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1 className={cn("text-title", className)} data-slot="page-title" {...props}>
      {children}
    </h1>
  );
}

/** One supporting line under the title, its facts side by side. */
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

/**
 * The section's title with its count or one action on the same line, or under it when the line is
 * too narrow for both, so a long detail never squeezes the title to a word a line.
 */
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

/**
 * A section's name as a quiet label over its content, so the content leads: "YOUR PATH",
 * "PRACTICE ANYTIME".
 */
export function PageSectionTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-label min-w-0 text-balance", className)}
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
      className={cn("text-muted-foreground min-w-0 font-mono text-xs tabular-nums", className)}
      data-slot="page-section-detail"
      {...props}
    />
  );
}

/** A group's name inside a section ("Objective tests", "Physics"), over its list. */
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

/** A note under the section's content: where its numbers come from, or the rule it follows. */
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
