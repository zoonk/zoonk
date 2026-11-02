import { AdminSectionEmpty } from "@/components/admin-section";
import { AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
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
  if (isEmpty) {
    return <AdminSectionEmpty>{emptyLabel}</AdminSectionEmpty>;
  }

  return (
    <Table>
      <AdminTableColumnsHeader columns={columns} />
      <TableBody>{children}</TableBody>
    </Table>
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
    <Table>
      <AdminTableColumnsHeader columns={columns} />
      <AdminTableSkeletonRows>
        <AdminTableColumnsSkeletonRow columns={columns} />
      </AdminTableSkeletonRows>
    </Table>
  );
}
