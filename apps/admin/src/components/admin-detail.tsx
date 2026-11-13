import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { DetailFacts } from "@zoonk/ui/components/detail";
import { PageTitle } from "@zoonk/ui/components/page-top";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { AdminHeader, type AdminParent } from "./admin-header";

export function AdminDetailPage({ children }: { children: React.ReactNode }) {
  return <Container className="flex-1 gap-8">{children}</Container>;
}

/** What the shared bottom bar reads to reach the frame's edges: the body's own side and bottom room. */
const BAR_FRAME_CLASS =
  "flex-1 sm:flex-1 [--page-bottom:--spacing(12)] [--page-gutter:--spacing(4)] sm:[--page-gutter:--spacing(8)] lg:[--page-bottom:--spacing(16)] lg:[--page-gutter:--spacing(10)]";

/**
 * A record's body. A record whose page is one decision passes its `bar` (the shared `BottomBar`):
 * the body then fills the window, so the bar rests at the bottom whether the page is short or long.
 */
export function AdminDetailBody({
  bar,
  children,
}: {
  bar?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!bar) {
    return <ContainerBody className="gap-8">{children}</ContainerBody>;
  }

  return (
    <ContainerBody className={cn("gap-8", BAR_FRAME_CLASS)}>
      <div className="flex flex-1 flex-col gap-8">{children}</div>
      {bar}
    </ContainerBody>
  );
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
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
      <aside className="flex min-w-0 flex-col gap-8">{aside}</aside>
    </div>
  );
}

/** A record's name is its own words, so a long one wraps and balances. */
const TITLE_CLASS = "text-balance wrap-break-word";

export function AdminDetailHeader({
  actions,
  alert,
  facts,
  mark,
  menu,
  parents,
  title,
  titleClassName,
}: {
  /** Small buttons (`size="sm"`), so they sit level with the title. */
  actions?: React.ReactNode;
  alert?: string | null;
  facts: (string | null | undefined | false)[];
  /** What the record is, drawn before its name: a person's photo or initials. */
  mark?: React.ReactNode;
  menu?: React.ReactNode;
  /** The pages over this record, the list first. The way back names the nearest one. */
  parents: AdminParent[];
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
      parent={parents.at(-1)}
      title={
        mark ? (
          <span className="flex min-w-0 items-center gap-3">
            {mark}
            <PageTitle className={cn(TITLE_CLASS, titleClassName)}>{title}</PageTitle>
          </span>
        ) : (
          <PageTitle className={cn(TITLE_CLASS, titleClassName)}>{title}</PageTitle>
        )
      }
    >
      {/* A record's facts here are names, a plan and dates: words, so the text face (Main's are counts). */}
      <DetailFacts className="font-sans">
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
  parents: AdminParent[];
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
      parent={parents.at(-1)}
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
