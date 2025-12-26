import { prisma } from "@zoonk/db";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { AdminPagination } from "@/components/pagination";
import { parseSearchParams } from "@/lib/parse-search-params";
import { CourseRow } from "./course-row";

export default async function CourseList({
  searchParams,
}: {
  searchParams: PageProps<"/courses">["searchParams"];
}) {
  const { page, limit, offset, search } = parseSearchParams(await searchParams);

  const where = search
    ? { normalizedTitle: { contains: search, mode: "insensitive" as const } }
    : undefined;

  const [courses, total] = await Promise.all([
    prisma.course.findMany({
      include: { organization: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    }),
    prisma.course.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {courses.map((course) => (
              <CourseRow course={course} key={course.id} />
            ))}
          </TableBody>
        </Table>
      </div>

      <AdminPagination
        basePath="/courses"
        limit={limit}
        page={page}
        search={search}
        totalPages={totalPages}
      />
    </>
  );
}
