import { TableBody } from "@zoonk/ui/components/table";
import { Fragment } from "react";

const SKELETON_ROW_KEYS = ["first", "second", "third", "fourth", "fifth"];

export function AdminTableSkeletonRows({ children }: React.PropsWithChildren) {
  return (
    <TableBody>
      {SKELETON_ROW_KEYS.map((rowKey) => (
        <Fragment key={rowKey}>{children}</Fragment>
      ))}
    </TableBody>
  );
}
