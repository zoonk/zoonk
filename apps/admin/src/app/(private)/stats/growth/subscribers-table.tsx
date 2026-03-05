import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export function SubscribersTable({ data }: { data: { plan: string; count: number }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plan</TableHead>
          <TableHead className="text-right">Subscribers</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {data.map((sub) => (
          <TableRow key={sub.plan}>
            <TableCell className="font-medium capitalize">{sub.plan}</TableCell>
            <TableCell className="text-right tabular-nums">{sub.count.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
