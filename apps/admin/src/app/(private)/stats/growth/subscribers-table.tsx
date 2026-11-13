import { AdminTableRow } from "@/components/admin-table-row";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";

export function SubscribersTable({ data }: { data: { plan: string; count: number }[] }) {
  return (
    <Table>
      <TableHeader>
        <AdminTableRow>
          <TableHead>Plan</TableHead>
          <TableHead numeric>Subscribers</TableHead>
        </AdminTableRow>
      </TableHeader>

      <TableBody>
        {data.length > 0 ? (
          data.map((sub) => (
            <AdminTableRow key={sub.plan}>
              <TableCell className="font-medium capitalize">{sub.plan}</TableCell>
              <TableCell numeric>{sub.count.toLocaleString()}</TableCell>
            </AdminTableRow>
          ))
        ) : (
          <AdminTableRow>
            <TableCell className="text-muted-foreground" colSpan={2}>
              No active subscribers yet.
            </TableCell>
          </AdminTableRow>
        )}
      </TableBody>
    </Table>
  );
}
