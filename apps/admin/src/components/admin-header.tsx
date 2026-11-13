import { CONTAINER_HEADER_EDGES_CLASS } from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The top of every Admin page, list or record: the line over the title (a record's crumb, or its
 * empty room, so every title starts at one height), the title with its actions level with it, then
 * what `children` says about it. On a phone the actions follow below, except a lone menu
 * (`actionsBesideTitle`), which stays beside the title.
 */
export function AdminHeader({
  actions,
  actionsBesideTitle = false,
  children,
  crumb,
  title,
}: {
  actions?: React.ReactNode;
  actionsBesideTitle?: boolean;
  children?: React.ReactNode;
  crumb?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        CONTAINER_HEADER_EDGES_CLASS,
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 *:col-span-2",
      )}
      data-slot="admin-header"
    >
      {crumb ?? <span aria-hidden="true" className="h-4" data-slot="page-eyebrow" />}

      <div
        className={cn("min-w-0", actions && "md:col-span-1", actionsBesideTitle && "col-span-1")}
      >
        {title}
      </div>

      {actions ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 self-center md:col-span-1",
            actionsBesideTitle ? "col-span-1" : "max-md:order-last max-md:mt-3",
          )}
          data-slot="admin-header-actions"
        >
          {actions}
        </div>
      ) : null}

      {children}
    </header>
  );
}
