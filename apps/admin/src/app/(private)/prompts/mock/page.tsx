import dump from "@/app/(private)/_mock/data/prompts.json";
import {
  type Dump,
  Lead,
  MockList,
  MockSearch,
  MockViews,
  day,
  language,
  parts,
} from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "They typed" },
  { label: "Zoonk read it as", size: "long" as const },
  { label: "Outcome", size: "wide" as const },
  { label: "Who", size: "text" as const },
  { label: "Date" },
];

const OUTCOMES = [
  "All",
  "Goal created",
  "Not confirmed",
  "Too vague",
  "Declined",
  "Failed",
  "In progress",
];

export default function GoalRequestsMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 12);

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => [
        <Lead key="lead" second={language(row[4]?.text)} title={row[0]?.text} />,
        <span className="block" key="read">
          {parts(row[2])[0]}
          <span className="block text-xs">{parts(row[2])[1]}</span>
        </span>,
        row[1]?.text,
        <span className="block" key="who">
          {parts(row[3])[0]}
          <span className="block truncate text-xs">{parts(row[3])[1]}</span>
        </span>,
        day(row[5]?.text),
      ])}
      title="Goal requests"
      toolbar={
        <>
          <MockSearch placeholder="Search requests, names, or emails…" />
          <MockViews
            label="Outcome"
            views={OUTCOMES.map((label, index) => ({ active: index === 0, label }))}
          />
        </>
      }
    />
  );
}
