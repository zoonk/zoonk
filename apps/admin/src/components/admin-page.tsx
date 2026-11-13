import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";
import { AdminHeader } from "./admin-header";

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
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  title: string;
}) {
  return (
    <AdminHeader actions={actions} title={<ContainerTitle>{title}</ContainerTitle>}>
      {children ? (
        <ContainerDescription className="max-w-2xl">{children}</ContainerDescription>
      ) : null}
    </AdminHeader>
  );
}

export function AdminPageBody({ children, className }: React.ComponentProps<"section">) {
  return <ContainerBody className={className}>{children}</ContainerBody>;
}

/** Alone on its row on a phone, the search keeps a field's height; in the toolbar it takes the toolbar's. */
export const ADMIN_TOOLBAR_SEARCH_CLASS = "pl-9 md:h-7.5 md:rounded-md md:pl-8 md:text-compact";

/**
 * The one row above a table: its search first, then its views and filters. Its controls share one
 * height. A current view's fill hangs 10 px into the gap, so the gap is wide enough to keep it
 * clear of the control beside it.
 */
export function AdminToolbar({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", className)}>{children}</div>
  );
}
