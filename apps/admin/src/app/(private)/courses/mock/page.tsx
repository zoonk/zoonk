import dump from "@/app/(private)/_mock/data/courses.json";
import {
  type Dump,
  Lead,
  MockList,
  MockSearch,
  language,
  parts,
  readView,
} from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Course" },
  { label: "Language" },
  { align: "right" as const, label: "Chapters" },
  { align: "right" as const, label: "Lessons written" },
  { label: "Published" },
];

export default async function CoursesMockPage({ searchParams }: PageProps<"/courses/mock">) {
  const search = readView((await searchParams).search);
  const rows = search ? [] : ((dump as Dump).tables[0]?.rows ?? []).slice(0, 14);

  return (
    <MockList
      columns={COLUMNS}
      empty={`No courses match "${search}".`}
      rows={rows.map((row) => [
        <Lead key="lead" second={parts(row[0])[1]} title={parts(row[0])[0]} />,
        language(row[2]?.text),
        row[3]?.text,
        row[4]?.text,
        row[5]?.text === "—" ? "No" : "Yes",
      ])}
      title="Courses"
      toolbar={<MockSearch placeholder="Search by title…" value={search} />}
    />
  );
}
