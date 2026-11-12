import dump from "@/app/(private)/_mock/data/skills.json";
import {
  type Dump,
  Lead,
  MockList,
  MockSearch,
  MockSelect,
  MockViews,
  language,
} from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Skill" },
  { label: "Level" },
  { align: "right" as const, label: "Lessons" },
  { align: "right" as const, label: "Practice questions" },
  { align: "right" as const, label: "Learners" },
];

export default function SkillsMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 14);

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => [
        <Lead key="lead" second={language(row[1]?.text)} title={row[0]?.text} />,
        row[2]?.text,
        row[4]?.text,
        row[5]?.text,
        row[6]?.text,
      ])}
      title="Skills"
      toolbar={
        <>
          <MockSearch placeholder="Search skills by name…" />
          <MockSelect>All languages</MockSelect>
          <MockViews
            label="Who can see it"
            views={[{ active: true, label: "All" }, { label: "Public" }, { label: "Private" }]}
          />
          <MockViews
            label="Merged"
            views={[{ active: true, label: "Hide merged" }, { label: "Show merged" }]}
          />
        </>
      }
    />
  );
}
