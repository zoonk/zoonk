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
      <ContainerHeaderGroup>
        <ContainerTitle>{title}</ContainerTitle>
        {children ? (
          <ContainerDescription className="max-w-2xl">{children}</ContainerDescription>
        ) : null}
      </ContainerHeaderGroup>

      {actions ? <ContainerActions>{actions}</ContainerActions> : null}
    </ContainerHeader>
  );
}

export function AdminPageBody({ children, className }: React.ComponentProps<"section">) {
  return <ContainerBody className={className}>{children}</ContainerBody>;
}

/** The one row above a table: its search first, then its filters. */
export function AdminToolbar({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>{children}</div>
  );
}
