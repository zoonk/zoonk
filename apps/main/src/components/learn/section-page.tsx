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
import { PageWithAside } from "@zoonk/learn/shell";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { cn } from "@zoonk/ui/lib/utils";
import { SectionBarFrame, type SectionLink, SectionTitleEnd } from "./section-layout";

/**
 * From `xl`, for whoever has a session, beside the pages of the section that have something for
 * it: what the section put there, or what the page says beside its rows (`PageAsideNote`). With
 * neither (a page the section adds nothing to, a visitor with no account to show) it isn't drawn.
 */
const ASIDE_CLASS =
  "hidden min-[72rem]:hidden xl:in-data-signed-in:flex xl:in-data-signed-in:not-has-[>*>*]:not-group-has-[[data-slot=page-aside-note]]/page-aside:hidden";

/** The section's title from a tablet up, with its action at the row's end (`SectionTitleEnd`). */
function SectionTitleRow({
  end,
  hub,
  parents,
}: {
  end?: React.ReactNode;
  hub: SectionLink;
  parents?: SectionLink[];
}) {
  return (
    <div className={PAGE_HEADER_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-title min-w-0" data-slot="section-title">
          {hub.title}
        </p>
        {end && (
          <SectionTitleEnd hub={hub} parents={parents}>
            {end}
          </SectionTitleEnd>
        )}
      </div>
    </div>
  );
}

export function SectionPage({
  aside,
  asideLabel = "",
  children,
  end,
  hub,
  measure,
  nav,
  parents,
}: {
  /** What supports every page of the section; the pages' main column then ends where it starts. */
  aside?: React.ReactNode;
  asideLabel?: string;
  children: React.ReactNode;
  end?: React.ReactNode;
  hub: SectionLink;
  /** The section's one column: its bar's actions, title, tabs and pages all end on its edge. */
  measure?: PageMeasure;
  nav: React.ReactNode;
  /** Pages with pages of their own: those go back to them rather than to the hub. */
  parents?: SectionLink[];
}) {
  const section = (
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
          <SectionTitleRow end={end} hub={hub} parents={parents} />
          {nav}
        </div>

        {children}
      </div>
    </div>
  );

  return aside ? (
    <PageWithAside
      aside={aside}
      asideClassName={ASIDE_CLASS}
      asideLabel={asideLabel}
      className="flex-1"
    >
      {section}
    </PageWithAside>
  ) : (
    section
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
