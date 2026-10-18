import {
  PAGE_COLUMN_CLASS,
  PageEyebrow,
  PageHeader,
  PageHeaderContent,
  PageSubtitle,
  PageTitle,
} from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { SectionBarFrame } from "./section-layout";

type SectionHubLink = { href: string; title: string };

/**
 * A section of several pages (statistics, settings) inside the app's frame. From a tablet up the
 * section owns the header: a quiet line of context, its name where every other page's title sits,
 * and its pages as tabs under it with a hairline under them, so moving between its pages swaps
 * only what's under the tabs. Each page still opens with its own heading (`SectionPageHeader`):
 * on a phone, where the section's first page (the hub) lists its pages, it's the page's title;
 * from a tablet up, where the tab marks the page, it's for screen readers. On a phone the
 * section's own bar is the page's top: the hub goes back to the app page the learner left for it,
 * or Today, each page under it back to the hub, and Escape presses it. From a tablet up the tabs
 * and the app's tab bar (or sidebar) do that job, so the bar would only repeat the title.
 */
export function SectionPage({
  children,
  contentClassName,
  end,
  eyebrow,
  hub,
  nav,
}: {
  children: React.ReactNode;
  /**
   * The pages' measure under the section's header, which spans the room: statistics are a
   * dashboard and fill it; settings are forms and keep their measure on the same left edge.
   */
  contentClassName?: string;
  /** One action of the section's on the right of its bar (a visitor's or a guest's way in). */
  end?: React.ReactNode;
  /** The quiet line over the title (what the numbers cover, whose account); its line is kept. */
  eyebrow?: React.ReactNode;
  hub: SectionHubLink;
  /** The section's pages, as `SectionNav`. */
  nav: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // From a tablet up the section's header is the page's top, with its eyebrow's line: a
        // page's own header under its tabs (the subscription's offer) starts right under them.
        PAGE_COLUMN_CLASS,
        "flex flex-1 flex-col gap-6 md:**:data-[slot=page-header-content]:pt-0",
      )}
      data-slot="section-page"
    >
      <SectionBarFrame
        backHref="/today"
        className="-mx-4 -mt-4 sm:-mx-8 sm:-mt-6 md:hidden"
        end={end}
        hub={hub}
      />

      <div className="-mx-2.5 hidden flex-col gap-3 border-b px-2.5 pb-3 md:flex">
        <div className="flex flex-col gap-1">
          <PageEyebrow className="min-h-4">{eyebrow}</PageEyebrow>
          {/* The section's name; the page's own heading follows under its tabs. */}
          <p className="text-title" data-slot="section-title">
            {hub.title}
          </p>
        </div>
        {nav}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col gap-6", contentClassName)}>{children}</div>
    </div>
  );
}

/**
 * A section page's own header: on a phone its title (the page's `h1`), with an optional quiet
 * line over it and one under it; from a tablet up the section's header names the section and its
 * tab marks the page, so the title stays for screen readers and the lines go.
 */
export function SectionPageHeader({
  description,
  eyebrow,
  title,
}: {
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: string;
}) {
  return (
    <PageHeader className="md:contents">
      <PageHeaderContent className="md:contents">
        {eyebrow && <PageEyebrow className="md:hidden">{eyebrow}</PageEyebrow>}
        <PageTitle className="md:sr-only">{title}</PageTitle>
        {description && <PageSubtitle className="md:hidden">{description}</PageSubtitle>}
      </PageHeaderContent>
    </PageHeader>
  );
}
