import {
  Container,
  ContainerActions,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";

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
    <ContainerHeader variant="sidebar">
      <ContainerHeaderGroup className="flex-1">
        <div className="flex items-center justify-between gap-4">
          <ContainerTitle>{title}</ContainerTitle>
          {/* The title carries 20 px of padding above its line: these margins center the action on the line and keep the row's height the title's. */}
          {actions ? <ContainerActions className="mt-3 -mb-2">{actions}</ContainerActions> : null}
        </div>
        {children ? (
          <ContainerDescription className="max-w-2xl">{children}</ContainerDescription>
        ) : null}
      </ContainerHeaderGroup>
    </ContainerHeader>
  );
}

export function AdminPageBody({ children, className }: React.ComponentProps<"section">) {
  return <ContainerBody className={className}>{children}</ContainerBody>;
}

/** Alone on its row on a phone, the search keeps a field's height; in the toolbar it takes the toolbar's. */
export const ADMIN_TOOLBAR_SEARCH_CLASS = "pl-9 md:h-7.5 md:rounded-md md:pl-8 md:text-[0.8125rem]";

/** The one row above a table: its search first, then its filters. Its controls share one height. */
export function AdminToolbar({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>{children}</div>
  );
}
