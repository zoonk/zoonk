import { SectionPageHeader } from "@/components/learn/section-page";
import { Page } from "@zoonk/learn/page";

export function StatsPage({
  children,
  description,
  sectionNote,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  /** The section's own line, which its header already shows from a tablet up. */
  sectionNote?: string;
  title: string;
}) {
  return (
    <Page data-slot="stats-page" measure="list">
      <SectionPageHeader description={description} note={sectionNote} title={title} />
      {children}
    </Page>
  );
}
