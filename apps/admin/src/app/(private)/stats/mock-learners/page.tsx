import dump from "@/app/(private)/_mock/data/stats-learner-milestones.json";
import { type Dump, Lead, MockList, day, parts } from "@/app/(private)/_mock/kit";
import { AdminSmallInput } from "@/components/admin-small-input";

const COLUMNS = [
  { label: "Learner" },
  { align: "right" as const, label: "Lessons" },
  { align: "right" as const, label: "Days" },
  { align: "right" as const, label: "Brain Power" },
  { label: "Last completed" },
  { label: "Joined" },
];

export default function LearnersByLessonsMockPage() {
  const rows = (dump as Dump).tables[0]?.rows ?? [];

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => [
        <Lead key="lead" second={parts(row[0])[1]} title={parts(row[0])[0]} />,
        row[1]?.text,
        row[2]?.text,
        row[3]?.text,
        day(row[4]?.text),
        day(row[5]?.text),
      ])}
      title="Learners by lessons completed"
      toolbar={
        <label className="flex items-center gap-2 text-sm">
          At least
          <AdminSmallInput
            className="md:text-compact px-2.5"
            defaultValue={10}
            frameClassName="w-16"
            inputMode="numeric"
          />
          lessons
        </label>
      }
    />
  );
}
