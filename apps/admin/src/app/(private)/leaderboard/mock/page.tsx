import dump from "@/app/(private)/_mock/data/leaderboard-7.json";
import { type Dump, Lead, MockList, MockViews, parts, readView } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Rank" },
  { fill: true, label: "Learner" },
  { align: "right" as const, label: "Brain Power" },
];

export default async function LeaderboardMockPage({
  searchParams,
}: PageProps<"/leaderboard/mock">) {
  const today = readView((await searchParams).period) === "today";
  const rows = today ? [] : ((dump as Dump).tables[0]?.rows ?? []).slice(0, 14);

  return (
    <MockList
      columns={COLUMNS}
      empty="No Brain Power earned today."
      rows={rows.map((row) => [
        <span className="font-mono text-[0.8125rem]" key="rank">
          {row[0]?.text}
        </span>,
        <span className="text-foreground block" key="lead">
          <Lead second={parts(row[1])[1]} title={parts(row[1])[0]} />
        </span>,
        <span className="text-foreground font-medium" key="power">
          {row[3]?.text}
        </span>,
      ])}
      title="Leaderboard"
      toolbar={
        <MockViews
          label="Period"
          views={[
            { active: today, label: "Today" },
            { active: !today, label: "7 days" },
            { label: "30 days" },
          ]}
        />
      }
    />
  );
}
