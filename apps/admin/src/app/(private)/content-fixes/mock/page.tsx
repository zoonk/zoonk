import dump from "@/app/(private)/_mock/data/content-fixes.json";
import { type Dump, Lead, MockList, MockViews, parts, readView } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Fix" },
  { label: "Where", size: "long" as const },
  { label: "Proposed by", size: "wide" as const },
];

export default async function ContentFixesMockPage({
  searchParams,
}: PageProps<"/content-fixes/mock">) {
  const decided = readView((await searchParams).view) === "decided";
  const rows = decided ? [] : ((dump as Dump).tables[0]?.rows ?? []);

  return (
    <MockList
      columns={COLUMNS}
      empty="No fix has been decided yet."
      rows={rows.map((row) => [
        <Lead key="lead" title={row[0]?.text} />,
        <span className="block whitespace-normal" key="where">
          {row[1]?.text}
        </span>,
        <span className="block" key="who">
          {parts(row[2])[1]}
          <span className="block text-xs">{parts(row[2])[0]}</span>
        </span>,
      ])}
      title="Content fixes"
      toolbar={
        <MockViews
          label="State"
          views={[
            { active: !decided, count: 2, label: "Waiting" },
            { active: decided, label: "Decided" },
          ]}
        />
      }
    />
  );
}
