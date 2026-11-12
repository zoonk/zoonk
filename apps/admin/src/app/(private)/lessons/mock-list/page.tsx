import dump from "@/app/(private)/_mock/data/lessons.json";
import { type Dump, Lead, MockList, MockSearch, MockSelect, MockViews, day, parts } from "@/app/(private)/_mock/kit";
import { MockConfirmButton } from "@/app/(private)/_mock/menu";
import { Label } from "@zoonk/ui/components/label";

const COLUMNS = [
  { label: "Lesson" },
  { label: "Course and chapter" },
  { label: "State" },
  { align: "right" as const, label: "Screens" },
  { label: "Updated" },
];

const STATES = ["All", "Written", "Not written", "Writing", "Failed"];

export default function LessonsMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 14);

  return (
    <MockList
      actions={
        <MockConfirmButton
          confirmLabel="Rewrite 25 lessons"
          description="31 published lessons match. This rewrites the oldest 25: they leave play until the new version passes the checks. Learners keep their answers."
          label="Rewrite by model"
          title="Rewrite lessons by model"
        >
          <div className="flex flex-col gap-2">
            <Label>Model</Label>
            <MockSelect>openai/gpt-6.1-sol (560 screens)</MockSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Prompt version</Label>
            <MockSelect>All prompt versions</MockSelect>
          </div>
        </MockConfirmButton>
      }
      columns={COLUMNS}
      rows={rows.map((row) => [
        <Lead key="lead" second={parts(row[0])[1]?.replace("pt", "Portuguese").replace("en", "English").replace("beginner", "Beginner")} title={parts(row[0])[0]} />,
        <span className="block" key="where">
          {parts(row[1])[0]}
          <span className="block text-xs">{parts(row[1])[1]}</span>
        </span>,
        row[2]?.text === "Failed" ? (
          <span className="text-destructive-text">Failed</span>
        ) : (
          row[2]?.text
        ),
        row[3]?.text,
        day(row[5]?.text),
      ])}
      title="Lessons"
      toolbar={
        <>
          <MockSearch placeholder="Search by lesson, chapter, or course…" />
          <MockViews
            label="State"
            views={STATES.map((label, index) => ({ active: index === 0, label }))}
          />
        </>
      }
    />
  );
}
