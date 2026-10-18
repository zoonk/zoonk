import { SectionPageHeader } from "@/components/learn/section-page";
import { Page } from "@zoonk/learn/page";

/**
 * A page of the statistics section: its heading (the title on a phone, with one short line when
 * the title alone doesn't say what the numbers cover; for screen readers from a tablet up, where
 * the section's header and tab name it), then its numbers.
 */
export function StatsPage({
  children,
  description,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  /** One short line, only where the title alone doesn't say what the numbers cover. */
  description?: string;
  /** The quiet line over the title, as the section's header has it. */
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
