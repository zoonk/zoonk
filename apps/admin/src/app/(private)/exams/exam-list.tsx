import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listExams } from "@/data/exams/list-exams";
import { parseSearchParams } from "@/lib/parse-search-params";
import { ExamRow } from "./exam-row";

const EXAM_COLUMNS: AdminTableColumn[] = [
  { label: "Exam" },
  { label: "Country" },
  { label: "Board" },
  { label: "Role" },
  { label: "Language" },
  { label: "Edition" },
  { label: "Exam date" },
  { label: "Registration ends" },
  { label: "Next check" },
  { align: "right", label: "Goals" },
  { align: "right", label: "Items" },
];

export async function ExamList({ searchParams }: Pick<PageProps<"/exams">, "searchParams">) {
  const { limit, offset, page } = parseSearchParams(await searchParams);

  return <CachedExamList limit={limit} offset={offset} page={page} />;
}

async function CachedExamList({
  limit,
  offset,
  page,
}: {
  limit: number;
  offset: number;
  page: number;
}) {
  "use cache: private";

  const { exams, total } = await listExams({ limit, offset });

  return (
    <>
      <AdminTableColumns
        columns={EXAM_COLUMNS}
        emptyLabel="No exam blueprints yet."
        isEmpty={exams.length === 0}
      >
        {exams.map((exam) => (
          <ExamRow exam={exam} key={exam.id} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/exams"
        limit={limit}
        page={page}
        totalPages={Math.ceil(total / limit)}
      />
    </>
  );
}

export function ExamListSkeleton() {
  return <AdminTableColumnsSkeleton columns={EXAM_COLUMNS} />;
}
