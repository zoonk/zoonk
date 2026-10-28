import { AdminSection } from "@/components/admin-section";
import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { type AdminReviewFlag, listOpenReviewFlags } from "@/data/review-flags/list-review-flags";
import { formatDateTime } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { ReviewFlagActions } from "./review-flag-actions";

const COLUMNS: AdminTableColumn[] = [{ label: "Flagged" }, { label: "" }];

function FlaggedTarget({ flag }: { flag: AdminReviewFlag }) {
  if (flag.lesson) {
    return (
      <Link className="hover:underline" href={`/lessons/${flag.lesson.id}`} prefetch={false}>
        Lesson · {flag.lesson.title}
      </Link>
    );
  }

  if (flag.item) {
    return (
      <Link className="hover:underline" href={`/items/${flag.item.id}`} prefetch={false}>
        Question · {flag.item.sourceCitation ?? flag.item.format}
      </Link>
    );
  }

  return "—";
}

function NoticeOrigin({ notice }: { notice: AdminReviewFlag["notice"] }) {
  const exam = notice.examBlueprint;

  return exam ? (
    <Link className="text-sm hover:underline" href={`/exams/${exam.id}`} prefetch={false}>
      {exam.name}
    </Link>
  ) : (
    <Link
      className="text-sm hover:underline"
      href={`/sources/${notice.source.id}`}
      prefetch={false}
    >
      {notice.source.title}
    </Link>
  );
}

function describeNotice(notice: AdminReviewFlag["notice"]): string {
  const fields = notice.fields.length > 0 ? ` · changed: ${notice.fields.join(", ")}` : "";
  return `${formatDateTime(notice.createdAt)}${fields}`;
}

export async function ReviewFlagList() {
  const flags = await listOpenReviewFlags();
  const groups = [...Map.groupBy(flags, (flag) => flag.noticeId).values()];

  if (groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing needs review. Content built on a source that changes shows up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const [first] = group;

        return first ? (
          <AdminSection
            action={<NoticeOrigin notice={first.notice} />}
            description={describeNotice(first.notice)}
            key={first.noticeId}
            title={first.notice.message}
          >
            <AdminTableColumns columns={COLUMNS} emptyLabel="Nothing flagged" isEmpty={false}>
              {group.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="min-w-64 whitespace-normal">
                    <FlaggedTarget flag={flag} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ReviewFlagActions flagId={flag.id} />
                  </TableCell>
                </TableRow>
              ))}
            </AdminTableColumns>
          </AdminSection>
        ) : null;
      })}
    </div>
  );
}

export function ReviewFlagListSkeleton() {
  return <AdminTableColumnsSkeleton columns={COLUMNS} />;
}
