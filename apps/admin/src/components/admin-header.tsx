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
  const beside = actions ? "col-span-2 md:col-span-1" : "col-span-2";

  return (
    <header
      className={cn(
        CONTAINER_HEADER_EDGES_CLASS,
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1",
      )}
      data-slot="admin-header"
    >
      <div className="col-span-2 min-w-0">
        {crumb ?? <span aria-hidden="true" className="block h-4" data-slot="page-eyebrow" />}
      </div>

      <div className={cn("min-w-0", actionsBesideTitle ? "col-span-1" : beside)}>{title}</div>

      {actions ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 self-center",
            actionsBesideTitle ? "col-span-1" : "max-md:order-last max-md:mt-3",
            !actionsBesideTitle && beside,
          )}
          data-slot="admin-header-actions"
        >
          {actions}
        </div>
      ) : null}

      {children ? <div className="col-span-2 min-w-0">{children}</div> : null}
    </header>
  );
}
