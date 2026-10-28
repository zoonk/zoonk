import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export type AdminTableColumn = { align?: "right"; label: string };

function AdminTableColumnsHeader({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((column) => (
          <TableHead className={column.align === "right" ? "text-right" : ""} key={column.label}>
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function AdminTableColumns({
  children,
  columns,
  emptyLabel,
  isEmpty,
}: {
  children: React.ReactNode;
  columns: AdminTableColumn[];
  emptyLabel: string;
  isEmpty: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <AdminTableColumnsHeader columns={columns} />

        <TableBody>
          {isEmpty ? (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={columns.length}>
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function AdminTableColumnsSkeletonRow({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <TableRow>
      {columns.map((column) => (
        <TableCell key={column.label}>
          <Skeleton className={column.align === "right" ? "ml-auto h-4 w-8" : "h-4 w-20"} />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function AdminTableColumnsSkeleton({ columns }: { columns: AdminTableColumn[] }) {
  return (
    <AdminTableSkeleton className="overflow-x-auto">
      <Table>
        <AdminTableColumnsHeader columns={columns} />
        <AdminTableSkeletonRows>
          <AdminTableColumnsSkeletonRow columns={columns} />
        </AdminTableSkeletonRows>
      </Table>
    </AdminTableSkeleton>
  );
}
