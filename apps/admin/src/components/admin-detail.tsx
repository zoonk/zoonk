import { FactSegments } from "@zoonk/learn/facts";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { DetailFacts } from "@zoonk/ui/components/detail";
import { PageTitle } from "@zoonk/ui/components/page-top";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { AdminHeader, type AdminParent } from "./admin-header";
import { AdminDisclosure } from "./admin-json";

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
 * Narrower, the facts follow below; a long tab's facts (`foldedAside`, their name) fold into one row
 * above it instead, so they are first without pushing what staff came for down a screen.
 */
export function AdminDetailColumns({
  aside,
  children,
  className,
  foldedAside,
}: {
  aside: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  foldedAside?: string;
}) {
  return (
    <div className={cn("grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10", className)}>
      {foldedAside ? (
        <div className="-mt-3 -mb-4 xl:hidden">
          <AdminDisclosure label={foldedAside}>
            <div className="flex flex-col gap-8 pt-2 pb-4 text-sm">{aside}</div>
          </AdminDisclosure>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
      <aside className={cn("flex min-w-0 flex-col gap-8", foldedAside && "max-xl:hidden")}>
        {aside}
      </aside>
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
  /** The page's buttons, in its top bar: `Button size="bar"`. */
  actions?: React.ReactNode;
  alert?: string | null;
  facts: React.ComponentProps<typeof FactSegments>["facts"];
  /** What the record is, drawn before its name: a person's photo or initials. */
  mark?: React.ReactNode;
  menu?: React.ReactNode;
  /** The pages over this record, the list first. The way back names the nearest one. */
  parents: AdminParent[];
  title: string;
  titleClassName?: string;
}) {
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
        <FactSegments
          facts={facts}
          lead={alert && <span className="text-destructive-text">{alert}</span>}
        />
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
            className={cn("h-11 rounded-lg lg:h-10", actions === "menu" ? "w-11 lg:w-10" : "w-40")}
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
