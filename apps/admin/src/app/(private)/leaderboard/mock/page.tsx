import dump from "@/app/(private)/_mock/data/leaderboard-7.json";
import { type Dump, Lead, MockList, MockViews, parts } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { align: "right" as const, label: "Rank" },
  { label: "Learner" },
  { align: "right" as const, label: "Brain Power" },
];

export default function LeaderboardMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 14);

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => [
        row[0]?.text,
        <Lead key="lead" second={parts(row[1])[1]} title={parts(row[1])[0]} />,
        row[3]?.text,
      ])}
      title="Leaderboard"
      toolbar={
        <MockViews
          label="Period"
          views={[{ label: "Today" }, { active: true, label: "7 days" }, { label: "30 days" }]}
        />
      }
    />
  );
}
