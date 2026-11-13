import { Page, PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { TITLE_ROW_CLASS } from "@zoonk/learn/title-row";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

function RowsSkeleton({ count, rowClassName }: { count: number; rowClassName: string }) {
  return (
    <div className="flex flex-col [&>*+*]:border-t">
      {Array.from({ length: count }, (_, index) => (
        <div className={rowClassName} key={index}>
          <Skeleton className="h-3.5 w-2/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function SectionSkeleton({
  className,
  count,
  rowClassName = "flex h-11 items-center",
}: {
  className?: string;
  count: number;
  rowClassName?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24 rounded-sm" />
        <RowsSkeleton count={count} rowClassName={rowClassName} />
      </div>
    </div>
  );
}

export async function PlanSkeleton() {
  const t = await getExtracted();

  return (
    <PageWithAside
      aside={
        <>
          <div className="hidden grid-cols-2 gap-x-6 min-[72rem]:grid">
            <Skeleton className="h-18 rounded-lg" />
            <Skeleton className="h-18 rounded-lg" />
          </div>
          <Skeleton className="hidden h-30 min-[72rem]:block" />
          <SectionSkeleton count={3} />
          <SectionSkeleton
            className="hidden min-[72rem]:block"
            count={5}
            rowClassName="flex h-8.5 items-center"
          />
        </>
      }
      asideClassName="sm:max-[72rem]:grid sm:max-[72rem]:grid-cols-2 sm:max-[72rem]:items-start sm:max-[72rem]:gap-x-10"
      asideLabel={t("Your plan at a glance")}
    >
      <Page aria-busy="true">
        <PageHeaderContent>
          <PageHeader className={cn(TITLE_ROW_CLASS, "gap-y-2")}>
            <PageTitle>{t("Plan")}</PageTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7.5 w-24 rounded-lg" />
              <Skeleton className="size-7.5 rounded-lg" />
            </div>
          </PageHeader>
          <PageSubtitle>
            <Skeleton className="my-1 h-3 w-48 rounded-sm" />
          </PageSubtitle>
        </PageHeaderContent>

        <div className="flex flex-col gap-2 sm:hidden">
          <Skeleton className="h-1 w-full rounded-xs" />
          <Skeleton className="h-4 w-40 rounded-sm" />
        </div>
        <Skeleton className="hidden h-21 w-full rounded-md sm:block" />

        <div className="grid grid-cols-2 gap-2 min-[72rem]:hidden">
          <Skeleton className="h-22 rounded-xl" />
          <Skeleton className="h-22 rounded-xl" />
        </div>

        <SectionSkeleton count={6} />
      </Page>
    </PageWithAside>
  );
}
