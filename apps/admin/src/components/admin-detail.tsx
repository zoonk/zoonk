import {
  CONTAINER_HEADER_EDGES_CLASS,
  Container,
  ContainerBody,
} from "@zoonk/ui/components/container";
import {
  DetailActions,
  DetailFacts,
  DetailHero,
  DetailHeroText,
  DetailTitle,
} from "@zoonk/ui/components/detail";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { AdminBreadcrumb, type AdminBreadcrumbParent } from "./admin-breadcrumb";

export function AdminDetailPage({ children }: { children: React.ReactNode }) {
  return <Container className="gap-8">{children}</Container>;
}

export function AdminDetailBody({ children }: { children: React.ReactNode }) {
  return <ContainerBody className="gap-8">{children}</ContainerBody>;
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
    <DetailHero className={cn(CONTAINER_HEADER_EDGES_CLASS, menu && MENU_HERO_CLASS)}>
      <DetailHeroText>
        <AdminBreadcrumb current={title} parents={parents} />
        <DetailTitle className={titleClassName}>{title}</DetailTitle>
        <DetailFacts>
          {alert && <span className="text-destructive-text">{alert}</span>}
          {alert && factsLine && <span aria-hidden="true">·</span>}
          {factsLine}
        </DetailFacts>
      </DetailHeroText>

      {(actions || menu) && (
        <DetailActions>
          {actions}
          {menu}
        </DetailActions>
      )}
    </DetailHero>
  );
}

const MENU_HERO_CLASS = "max-md:flex-row max-md:items-end max-md:justify-between";

export function AdminDetailHeaderSkeleton({
  actions,
  parents,
}: {
  actions?: "buttons" | "menu";
  parents: AdminBreadcrumbParent[];
}) {
  return (
    <DetailHero className={cn(CONTAINER_HEADER_EDGES_CLASS, actions === "menu" && MENU_HERO_CLASS)}>
      <DetailHeroText>
        <AdminBreadcrumb
          current={<Skeleton aria-hidden="true" className="h-3.5 w-28" />}
          parents={parents}
        />
        <span aria-hidden="true" className="text-title flex h-[1.1em] items-center">
          <Skeleton className="h-7 w-72 max-w-full" />
        </span>
        <span aria-hidden="true" className="flex h-5 items-end">
          <Skeleton className="h-3 w-56 max-w-full" />
        </span>
      </DetailHeroText>

      {actions && (
        <Skeleton
          aria-hidden="true"
          className={cn("h-11 shrink-0 rounded-lg", actions === "menu" ? "w-11" : "w-40")}
        />
      )}
    </DetailHero>
  );
}
