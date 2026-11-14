import { SectionPageHeader } from "@/components/learn/section-page";
import { Page } from "@zoonk/learn/page";

export function StatsPage({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Page data-slot="stats-page">
      <SectionPageHeader description={description} title={title} />
      {/* On a computer the tab names the page, so the header hides; the page's one line still shows. */}
      {description && (
        <p className="text-muted-foreground hidden text-sm text-pretty md:block">{description}</p>
      )}
      {children}
    </Page>
  );
}
