import {
  PAGE_COLUMN_CLASS,
  PageHeader,
  PageHeaderContent,
  type PageMeasure,
  PageSubtitle,
  PageTitle,
  TAB_ROW_GAP_CLASS,
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
}: {
  children: React.ReactNode;
  end?: React.ReactNode;
  hub: SectionLink;
  /** The section's one column: its bar's actions, title, tabs and pages all end on its edge. */
  measure?: PageMeasure;
  nav: React.ReactNode;
  /** A detail at the end of the section's name's row, from a tablet up, such as the account's email. */
  note?: React.ReactNode;
  /** Pages with pages of their own: those go back to them rather than to the hub. */
  parents?: SectionLink[];
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
      <SectionBarFrame end={end} hub={hub} parents={parents} />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-6",
          measure && "[&>*:not([data-slot=page],.contents)]:max-w-(--page-measure)",
        )}
      >
        <div className={cn(TAB_ROW_GAP_CLASS, "hidden md:flex")}>
          <div className={cn(PAGE_HEADER_CLASS, "flex-row items-center justify-between gap-4")}>
            <p className="text-title" data-slot="section-title">
              {hub.title}
            </p>
            {note && <PageSubtitle className="block min-w-0 truncate pt-0">{note}</PageSubtitle>}
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
        <PageTitle className="md:sr-only">{title}</PageTitle>
        {description && <PageSubtitle className="text-pretty md:pt-0">{description}</PageSubtitle>}
      </PageHeaderContent>
    </PageHeader>
  );
}
