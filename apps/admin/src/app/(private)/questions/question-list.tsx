import {
  type AdminTableColumn,
  AdminTableColumns,
  AdminTableColumnsSkeleton,
} from "@/components/admin-table-columns";
import { AdminPagination } from "@/components/pagination";
import { getVoteTotals, readVoteTotals } from "@/data/feedback/get-vote-totals";
import { listLessonQuestions } from "@/data/questions/list-lesson-questions";
import { parseSearchParams } from "@/lib/parse-search-params";
import { QuestionRow } from "./question-row";

const QUESTION_COLUMNS: AdminTableColumn[] = [
  { label: "Question" },
  { label: "Answer" },
  { label: "User" },
  { label: "Course / lesson" },
  { label: "Votes" },
  { label: "Status / asked" },
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

  const votes = await getVoteTotals({
    contentIds: questions.map((question) => question.id),
    contentKind: "lessonQuestion",
  });

  return (
    <>
      <AdminTableColumns
        columns={QUESTION_COLUMNS}
        emptyLabel="No questions found."
        isEmpty={questions.length === 0}
      >
        {questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            votes={readVoteTotals(votes, question.id)}
          />
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
