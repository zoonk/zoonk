import { Skeleton } from "@zoonk/ui/components/skeleton";

type StatsProps = {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
};

export function Stats({ title, value, icon }: StatsProps) {
  return (
    <div className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
      <header className="text-muted-foreground flex items-center gap-1.5">
        {icon && <span className="flex size-4 items-center justify-center rounded-lg">{icon}</span>}

        <h3 className="text-sm leading-tight font-medium">{title}</h3>
      </header>

      <div className="text-foreground w-full flex-none text-3xl font-medium tracking-tight">
        {value}
      </div>
    </div>
  );
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
