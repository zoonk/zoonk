import { Container, ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { PageTitle } from "@zoonk/ui/components/page-top";
import { cn } from "@zoonk/ui/lib/utils";
import { AdminHeader, type AdminParent } from "./admin-header";

/** A list, queue or numbers page: its title, then its body. Detail pages use `AdminDetailPage`. */
export function AdminPage({ children }: { children: React.ReactNode }) {
  return <Container>{children}</Container>;
}

/**
 * The title names what the page lists. `children` is for the rare page whose job is a procedure
 * staff follow from the page itself; a sentence that restates the title or explains how the system
 * works doesn't belong here.
 */
export function AdminPageHeader({
  actions,
  children,
  parent,
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** The page this one is reached from, when it isn't in the sidebar. */
  parent?: AdminParent;
  title: string;
}) {
  return (
    <AdminHeader actions={actions} parent={parent} title={<PageTitle>{title}</PageTitle>}>
      {children ? (
        <ContainerDescription className="max-w-column">{children}</ContainerDescription>
      ) : null}
    </AdminHeader>
  );
}

export function AdminPageBody({ children, className }: React.ComponentProps<"section">) {
  return <ContainerBody className={className}>{children}</ContainerBody>;
}

/**
 * The one row above a table: its search first, then its views and filters. Its controls share one
 * height, and the row is as tall as a search box's 44 px even when it holds only views, so every
 * list's table starts at one height. A current view's fill hangs 10 px into the gap, so the gap is
 * wide enough to keep it clear of the control beside it.
 */
export function AdminToolbar({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex min-h-11 flex-wrap items-center gap-x-6 gap-y-2", className)}>
      {children}
    </div>
  );
}
