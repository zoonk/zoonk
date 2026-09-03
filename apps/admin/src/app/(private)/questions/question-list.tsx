import { AdminTableSkeleton, AdminTableSkeletonRows } from "@/components/admin-table-skeleton";
import { AdminPagination } from "@/components/pagination";
import { listLessonQuestions } from "@/data/questions/list-lesson-questions";
import { parseSearchParams } from "@/lib/parse-search-params";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { QuestionRow } from "./question-row";

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
      <div className="rounded-lg border">
        <Table>
          <QuestionTableHeader />
          <TableBody>
            {questions.length > 0 ? (
              questions.map((question) => <QuestionRow key={question.id} question={question} />)
            ) : (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  No questions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

function QuestionTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Question</TableHead>
        <TableHead>Answer</TableHead>
        <TableHead>User</TableHead>
        <TableHead>Course / lesson</TableHead>
        <TableHead>Status / asked</TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function QuestionListSkeleton() {
  return (
    <AdminTableSkeleton className="overflow-x-auto">
      <Table>
        <QuestionTableHeader />
        <AdminTableSkeletonRows>
          <QuestionSkeletonRow />
        </AdminTableSkeletonRows>
      </Table>
    </AdminTableSkeleton>
  );
}

function QuestionSkeletonRow() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-56" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </TableCell>
    </TableRow>
  );
}
