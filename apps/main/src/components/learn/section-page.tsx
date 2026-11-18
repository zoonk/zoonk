import { AppEntryName } from "@zoonk/learn/bar";
import {
  PAGE_COLUMN_CLASS,
  PageHeader,
  PageHeaderContent,
  type PageMeasure,
  PageSubtitle,
  PageTitle,
  pageMeasureClass,
} from "@zoonk/learn/page";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { cn } from "@zoonk/ui/lib/utils";
import { SectionBarFrame, type SectionLink } from "./section-layout";

export function SectionPage({
  children,
  end,
  hub,
  measure,
  nav,
  note,
  parents,
  tabbedHub,
}: {
  children: React.ReactNode;
  end?: React.ReactNode;
  hub: SectionLink;
  /** The section's one column: its bar's actions, title, tabs and pages all end on its edge. */
  measure?: PageMeasure;
  nav: React.ReactNode;
  /** One line under the section's name, from a tablet up. */
  note?: React.ReactNode;
  /** Pages with pages of their own: those go back to them rather than to the hub. */
  parents?: SectionLink[];
  /** The hub becomes the first tab from a tablet up. */
  tabbedHub?: boolean;
}) {
  return (
    <div
      className={cn(
        PAGE_COLUMN_CLASS,
        "flex flex-1 flex-col",
        measure && [
          pageMeasureClass(measure),
          "[&_[data-slot=page-top-bar]>div]:max-w-(--page-measure)",
        ],
      )}
      data-slot="section-page"
    >
      <SectionBarFrame end={end} hub={hub} parents={parents} tabbedHub={tabbedHub} />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-6",
          measure && "[&>*:not([data-slot=page],.contents)]:max-w-(--page-measure)",
        )}
      >
        <div className="hidden flex-col gap-3 border-b pb-3 md:flex">
          <div className={PAGE_HEADER_CLASS}>
            <p className="text-title" data-slot="section-title">
              {hub.title}
            </p>
            {note && <p className="text-muted-foreground min-h-5 text-sm">{note}</p>}
          </div>
          {nav}
        </div>

        {children}
      </div>
    </div>
  );
}

/** From a tablet up the tab marks the page, so the title stays only for screen readers. */
export function SectionPageHeader({
  description,
  title,
}: {
  description?: React.ReactNode;
  title: string;
}) {
  return (
    <PageHeader className="md:contents">
      <PageHeaderContent className="md:contents">
        <AppEntryName name={title} />
        <PageTitle className="md:sr-only">{title}</PageTitle>
        {description && <PageSubtitle className="md:hidden">{description}</PageSubtitle>}
      </PageHeaderContent>
    </PageHeader>
  );
}
