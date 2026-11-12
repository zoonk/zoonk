import dump from "@/app/(private)/_mock/data/sources.json";
import { type Dump, Lead, MockList, MockSearch, MockViews, day, language, parts } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Source" },
  { label: "Kind" },
  { label: "Last checked" },
  { label: "Good until" },
  { label: "Used by" },
];

function usedBy(learners: string | undefined, exams: string | undefined) {
  const uses = [
    Number(exams) > 0 ? `${exams} ${Number(exams) === 1 ? "exam" : "exams"}` : "",
    Number(learners) > 0 ? `${learners} ${Number(learners) === 1 ? "learner" : "learners"}` : "",
  ].filter(Boolean);

  return uses.join(" · ") || "Nothing";
}

export default function SourcesMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 14);

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => [
        <Lead
          key="lead"
          second={[parts(row[0])[1], language(row[3]?.text)].filter(Boolean).join(" · ")}
          title={parts(row[0])[0]}
        />,
        row[1]?.text,
        day(row[4]?.text),
        row[5]?.text === "—" ? "No end date" : day(row[5]?.text),
        usedBy(row[7]?.text, row[8]?.text),
      ])}
      title="Sources"
      toolbar={
        <>
          <MockSearch placeholder="Search public sources by title…" />
          <MockViews
            label="Kind"
            views={[
              { active: true, label: "All kinds" },
              { label: "Official" },
              { label: "Secondary" },
              { label: "Upload" },
            ]}
          />
          <MockViews
            label="Who can see it"
            views={[{ active: true, label: "All" }, { label: "Public" }, { label: "Private" }]}
          />
        </>
      }
    />
  );
}
