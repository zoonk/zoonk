import { SectionPageHeader } from "@/components/learn/section-page";
import { Page } from "@zoonk/learn/page";

export function StatsPage({
  children,
  description,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <Page data-slot="stats-page">
      <SectionPageHeader description={description} eyebrow={eyebrow} title={title} />
      {children}
    </Page>
  );
}
