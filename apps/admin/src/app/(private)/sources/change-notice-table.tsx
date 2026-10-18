import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { ProvenanceLine } from "@/components/provenance";
import { type AdminChangeNotice } from "@/data/sources/list-change-notices";
import { formatDateTime } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";

const NOTICE_COLUMNS: AdminTableColumn[] = [
  { label: "Date" },
  { label: "Message" },
  { label: "Changed fields" },
  { label: "Provenance" },
];

const SOURCE_NOTICE_COLUMNS: AdminTableColumn[] = [...NOTICE_COLUMNS, { label: "Exam" }];

/**
 * Change notices, newest first: the line learners saw after a new fetch, the
 * blueprint paths that changed and the model that wrote it. A source page also
 * names the exam each notice belongs to.
 */
export function ChangeNoticeTable({
  emptyLabel,
  notices,
  showExam,
}: {
  emptyLabel: string;
  notices: AdminChangeNotice[];
  showExam: boolean;
}) {
  return (
    <AdminTableColumns
      columns={showExam ? SOURCE_NOTICE_COLUMNS : NOTICE_COLUMNS}
      emptyLabel={emptyLabel}
      isEmpty={notices.length === 0}
    >
      {notices.map((notice) => (
        <TableRow key={notice.id}>
          <TableCell className="text-muted-foreground">
            {formatDateTime(notice.createdAt)}
          </TableCell>
          <TableCell className="max-w-120 min-w-72 whitespace-normal">{notice.message}</TableCell>
          <TableCell className="max-w-64 font-mono text-xs whitespace-normal">
            {notice.fields.join(", ") || "—"}
          </TableCell>
          <TableCell>
            <ProvenanceLine provenance={notice} />
          </TableCell>
          {showExam ? (
            <TableCell>
              {notice.examBlueprint ? (
                <Link
                  className="hover:underline"
                  href={`/exams/${notice.examBlueprint.id}`}
                  prefetch={false}
                >
                  {notice.examBlueprint.name}
                </Link>
              ) : (
                "—"
              )}
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </AdminTableColumns>
  );
}
