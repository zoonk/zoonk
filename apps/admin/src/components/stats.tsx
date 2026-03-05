import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
import { StatsTitle } from "./stats-title";

function StatsContent({
  title,
  value,
  icon,
  description,
  help,
}: {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  help?: string;
}) {
  return (
    <div className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <header className="text-muted-foreground flex items-center gap-1.5">
        {icon && <span className="flex size-4 items-center justify-center rounded-lg">{icon}</span>}
        <StatsTitle help={help} title={title} />
      </header>

      <div className="w-full flex-none">
        <div className="text-foreground text-3xl font-medium tracking-tight">{value}</div>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
    </div>
  );
}

export function Stats({
  title,
  value,
  icon,
  description,
  help,
  href,
}: {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  help?: string;
  href?: string;
}) {
  const content = (
    <StatsContent description={description} help={help} icon={icon} title={title} value={value} />
  );

  if (href) {
    return (
      <Link className="hover:bg-muted/50 rounded-lg p-2 transition-colors" href={href}>
        {content}
      </Link>
    );
  }

  return content;
}

export function StatsSkeleton() {
  return (
    <div className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <header className="text-muted-foreground flex items-center gap-1.5">
        <Skeleton className="size-4 rounded-lg" />
        <Skeleton className="h-4 w-24 rounded" />
      </header>
      <div className="w-full flex-none">
        <Skeleton className="h-8 w-32 rounded" />
      </div>
    </div>
  );
}
