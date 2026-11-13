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
      {children}
    </Page>
  );
}
