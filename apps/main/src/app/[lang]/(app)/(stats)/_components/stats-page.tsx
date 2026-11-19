import { SectionPageHeader } from "@/components/learn/section-page";
import { Page } from "@zoonk/learn/page";

export function StatsPage({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Page data-slot="stats-page" measure="list">
      <SectionPageHeader title={title} />
      {children}
    </Page>
  );
}
