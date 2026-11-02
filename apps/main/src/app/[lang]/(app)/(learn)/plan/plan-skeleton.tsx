import { Page, PageHeader, PageHeaderContent, PageTitle } from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { Skeleton } from "@zoonk/ui/components/skeleton";
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
          <div className="flex h-4 items-center" data-slot="page-eyebrow">
            <Skeleton className="h-3 w-48 rounded-sm" />
          </div>
          <PageHeader className="items-center">
            <PageTitle>{t("Plan")}</PageTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              <Skeleton className="h-7.5 w-24 rounded-lg" />
              <Skeleton className="size-7.5 rounded-lg" />
            </div>
          </PageHeader>
        </PageHeaderContent>

        <div className="flex flex-col gap-2 sm:hidden">
          <Skeleton className="h-1 w-full rounded-[2px]" />
          <Skeleton className="h-4 w-40 rounded-sm" />
        </div>
        <Skeleton className="hidden h-21 w-full rounded-md sm:block" />

        <div className="grid grid-cols-2 gap-2 min-[72rem]:hidden">
          <Skeleton className="rounded-option h-22" />
          <Skeleton className="rounded-option h-22" />
        </div>

        <SectionSkeleton count={6} />
      </Page>
    </PageWithAside>
  );
}
