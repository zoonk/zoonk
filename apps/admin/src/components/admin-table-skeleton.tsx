import { TableBody } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

const SKELETON_ROW_KEYS = ["first", "second", "third", "fourth", "fifth"];

export function AdminTableSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border", className)}
      data-slot="admin-table-skeleton"
      {...props}
    />
  );
}

export function AdminTableSkeletonRows({ children }: React.PropsWithChildren) {
  return (
    <TableBody>
      {SKELETON_ROW_KEYS.map((rowKey) => (
        <Fragment key={rowKey}>{children}</Fragment>
      ))}
    </TableBody>
  );
}
