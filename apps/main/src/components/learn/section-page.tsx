import {
  PAGE_COLUMN_CLASS,
  PageEyebrow,
  PageHeader,
  PageHeaderContent,
  PageSubtitle,
  PageTitle,
} from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { SectionBarFrame, type SectionLink, SectionParentLink } from "./section-layout";

export function SectionPage({
  children,
  end,
  eyebrow,
  hub,
  nav,
  parents,
}: {
  children: React.ReactNode;
  end?: React.ReactNode;
  eyebrow?: React.ReactNode;
  hub: SectionLink;
  nav: React.ReactNode;
  /** Pages with pages of their own: those go back to them rather than to the hub. */
  parents?: SectionLink[];
}) {
  return (
    <div
      className={cn(
        PAGE_COLUMN_CLASS,
        "flex flex-1 flex-col gap-2 sm:gap-6 md:**:data-[slot=page-header-content]:pt-0",
      )}
      data-slot="section-page"
    >
      <SectionBarFrame
        backHref="/today"
        className="-mx-4 -mt-2 sm:-mx-8 sm:-mt-6 md:hidden"
        end={end}
        hub={hub}
        parents={parents}
      />

      <div className="-mx-2.5 hidden flex-col gap-3 border-b px-2.5 pb-3 md:flex">
        <div className="flex flex-col gap-1">
          <PageEyebrow className="min-h-4">{eyebrow}</PageEyebrow>
          <p className="text-title" data-slot="section-title">
            {hub.title}
          </p>
        </div>
        {nav}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <SectionParentLink hub={hub} parents={parents} />
        {children}
      </div>
    </div>
  );
}

/** From a tablet up the tab marks the page, so the title stays only for screen readers. */
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
