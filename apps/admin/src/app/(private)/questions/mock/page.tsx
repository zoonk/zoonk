import dump from "@/app/(private)/_mock/data/questions.json";
import { type Dump, MockList, MockSearch, day, parts } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Question" },
  { label: "Who" },
  { label: "Where", size: "long" as const },
  { label: "Asked" },
];

export default function BuddyQuestionsMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 10);

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => {
        const [status, asked] = parts(row[4]);
        const [course, lesson] = parts(row[3]);

        return [
          <a className="block max-w-xl" data-slot="table-row-link" href="#" key="lead">
            <span className="line-clamp-1 font-medium">{row[0]?.text}</span>
            <span className="text-muted-foreground line-clamp-1 text-xs">{row[1]?.text}</span>
          </a>,
          parts(row[2])[0],
          course === "Deleted lesson" || !course ? (
            <span className="text-faint">Lesson removed</span>
          ) : (
            <span className="block">
              {course}
              <span className="block max-w-64 truncate text-xs">{lesson}</span>
            </span>
          ),
          <span className="block" key="asked">
            {day(asked)}
            {status === "Completed" ? null : (
              <span className="text-destructive-text block text-xs">{status}</span>
            )}
          </span>,
        ];
      })}
      title="Buddy questions"
      toolbar={<MockSearch placeholder="Search questions, answers, lessons, courses, or users…" />}
    />
  );
}
