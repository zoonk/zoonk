import { Skeleton } from "@zoonk/ui/components/skeleton";
import { Stat, StatDetail, StatIcon, StatLabel, StatValue } from "@zoonk/ui/components/stat";
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
    <>
      <StatLabel>
        {icon && <StatIcon>{icon}</StatIcon>}
        <StatsTitle help={help} title={title} />
      </StatLabel>
      <StatValue>{value}</StatValue>
      {description && <StatDetail>{description}</StatDetail>}
    </>
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
      <Stat className="hover:bg-muted/50 transition-colors" render={<Link href={href} prefetch />}>
        {content}
      </Stat>
    );
  }

  return <Stat>{content}</Stat>;
}

export function StatsSkeleton() {
  return (
    <Stat>
      <Skeleton className="h-4 w-24 rounded" />
      <Skeleton className="h-7.5 w-20 rounded" />
      <Skeleton className="h-4 w-28 rounded" />
    </Stat>
  );
}
