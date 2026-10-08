import { getMenu } from "@/lib/menu";
import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { type StatsMetric } from "./stats-metric-tile";

/** The stat's icon beside its name, in the color its number uses. */
const ICON_TONE: Readonly<Record<StatsMetric, string>> = {
  activity: "text-info",
  energy: "text-energy",
  level: "text-foreground",
  patterns: "text-score",
  score: "text-score",
};

/**
 * A page of the statistics section. The overview opens with the section's large title, as every
 * hub does; a stat's page names itself as a small eyebrow (its icon and name), since its big number
 * right under it is the main thing, then its content in the section's column.
 */
export function StatsPage({
  children,
  description,
  metric,
  title,
}: {
  children: React.ReactNode;
  /** One short line, only where the title alone doesn't say what the numbers cover. */
  description?: string;
  /** The stat this page is about; the overview has none. */
  metric?: StatsMetric;
  title: string;
}) {
  if (!metric) {
    return (
      <Page data-slot="stats-page">
        <PageHeader>
          <PageHeaderContent>
            <PageTitle>{title}</PageTitle>
            {description && <PageSubtitle>{description}</PageSubtitle>}
          </PageHeaderContent>
        </PageHeader>

        {children}
      </Page>
    );
  }

  const { icon: Icon } = getMenu(metric);

  return (
    <div className="flex flex-col gap-3" data-slot="stats-page">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-muted-foreground flex items-center gap-2 text-[0.8125rem] font-semibold tracking-wide uppercase">
          <Icon aria-hidden="true" className={cn("size-4", ICON_TONE[metric])} />
          {title}
        </h1>
        {description && <p className="text-muted-foreground text-sm text-pretty">{description}</p>}
      </header>

      {children}
    </div>
  );
}
