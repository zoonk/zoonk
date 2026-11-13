import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
  emptyListLabel,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { listLessonQuestions } from "@/data/questions/list-lesson-questions";
import { parseSearchParams } from "@/lib/parse-search-params";
import { QuestionRow } from "./question-row";

const QUESTION_COLUMNS: AdminTableColumn[] = [
  { label: "Question", twoLines: true },
  { label: "Who", size: "text", twoLines: true },
  { label: "Where", size: "long", twoLines: true },
  { label: "Asked" },
];

export async function QuestionList({
  searchParams,
}: {
  searchParams: PageProps<"/questions">["searchParams"];
}) {
  const params = await searchParams;
  const { page, limit, offset, search } = parseSearchParams(params);

  return <CachedQuestionList limit={limit} offset={offset} page={page} search={search} />;
}

async function CachedQuestionList({
  limit,
  offset,
  page,
  search,
}: {
  limit: number;
  offset: number;
  page: number;
  search?: string;
}) {
  "use cache: private";

  const { questions, total } = await listLessonQuestions({ limit, offset, search });
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <AdminTableColumns
        columns={QUESTION_COLUMNS}
        emptyLabel={emptyListLabel({ noun: "questions", search })}
        isEmpty={questions.length === 0}
      >
        {questions.map((question) => (
          <QuestionRow key={question.id} question={question} />
        ))}
      </AdminTableColumns>

      <AdminPagination
        basePath="/questions"
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}

export function QuestionListSkeleton() {
  return <AdminTableColumnsSkeleton columns={QUESTION_COLUMNS} />;
}
