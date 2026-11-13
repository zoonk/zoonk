import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { DetailFacts, DetailTitle } from "@zoonk/ui/components/detail";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { AdminBreadcrumb, type AdminBreadcrumbParent } from "./admin-breadcrumb";
import { AdminHeader } from "./admin-header";

export function AdminDetailPage({ children }: { children: React.ReactNode }) {
  return <Container className="gap-8">{children}</Container>;
}

export function AdminDetailBody({ children }: { children: React.ReactNode }) {
  return <ContainerBody className="gap-8">{children}</ContainerBody>;
}

/**
 * A record's first tab on a wide window: what staff came for on the left, the short facts beside it.
 * Narrower, the facts follow below.
 */
export function AdminDetailColumns({
  aside,
  children,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12">
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
      <aside className="flex min-w-0 flex-col gap-8">{aside}</aside>
    </div>
  );
}

export function AdminDetailHeader({
  actions,
  alert,
  facts,
  menu,
  parents,
  title,
  titleClassName,
}: {
  /** Small buttons (`size="sm"`), so they sit level with the title. */
  actions?: React.ReactNode;
  alert?: string | null;
  facts: (string | null | undefined | false)[];
  menu?: React.ReactNode;
  parents: AdminBreadcrumbParent[];
  title: string;
  titleClassName?: string;
}) {
  const factsLine = facts.filter(Boolean).join(" · ");

  return (
    <AdminHeader
      actions={
        actions || menu ? (
          <>
            {actions}
            {menu}
          </>
        ) : null
      }
      actionsBesideTitle={!actions}
      crumb={<AdminBreadcrumb current={title} parents={parents} />}
      title={<DetailTitle className={titleClassName}>{title}</DetailTitle>}
    >
      <DetailFacts>
        {alert && <span className="text-destructive-text">{alert}</span>}
        {alert && factsLine && <span aria-hidden="true">·</span>}
        {factsLine}
      </DetailFacts>
    </AdminHeader>
  );
}

export function AdminDetailHeaderSkeleton({
  actions,
  parents,
}: {
  actions?: "buttons" | "menu";
  parents: AdminBreadcrumbParent[];
}) {
  return (
    <AdminHeader
      actions={
        actions ? (
          <Skeleton
            aria-hidden="true"
            className={cn("h-7.5 rounded-md", actions === "menu" ? "w-7.5" : "w-40")}
          />
        ) : null
      }
      actionsBesideTitle={actions === "menu"}
      crumb={
        <AdminBreadcrumb
          current={<Skeleton aria-hidden="true" className="h-3.5 w-28" />}
          parents={parents}
        />
      }
      title={
        <span aria-hidden="true" className="text-title flex h-lh items-center">
          <Skeleton className="h-7 w-72 max-w-full" />
        </span>
      }
    >
      <span aria-hidden="true" className="flex h-5 items-end">
        <Skeleton className="h-3 w-56 max-w-full" />
      </span>
    </AdminHeader>
  );
}
