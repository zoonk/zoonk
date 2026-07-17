import { TableBody } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

const SKELETON_ROW_KEYS = ["first", "second", "third", "fourth", "fifth"];

/**
 * Admin data tables share one bordered loading frame so every route preserves
 * the same table footprint while keeping its domain-specific header and rows
 * colocated with the real table.
 */
export function AdminTableSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border", className)}
      data-slot="admin-table-skeleton"
      {...props}
    />
  );
}

/**
 * Loading tables all use five stable placeholder rows. Centralizing the row
 * repetition removes index keys and keeps the route-specific row markup clear.
 */
export function AdminTableSkeletonRows({ children }: React.PropsWithChildren) {
  return (
    <TableBody>
      {SKELETON_ROW_KEYS.map((rowKey) => (
        <Fragment key={rowKey}>{children}</Fragment>
      ))}
    </TableBody>
  );
}
