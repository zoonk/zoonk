import dump from "@/app/(private)/_mock/data/items.json";
import { type Dump, Lead, MockList, MockSearch, MockSelect, language, readView } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Question" },
  { label: "Skill" },
  { label: "Format" },
  { align: "right" as const, label: "Answers" },
  { align: "right" as const, label: "Accuracy" },
];

export default async function ItemsMockPage({ searchParams }: PageProps<"/items/mock-list">) {
  const search = readView((await searchParams).search);
  const all = (dump as Dump).tables[0]?.rows ?? [];

  const rows = search
    ? all.filter((row) => row[0]?.text.toLowerCase().includes(search.toLowerCase()))
    : all.slice(0, 14);

  return (
    <MockList
      columns={COLUMNS}
      empty={`No practice questions match "${search}".`}
      rows={rows.map((row) => [
        <Lead key="lead" second={language(row[3]?.text)} title={row[0]?.text} />,
        row[1]?.text,
        row[2]?.text,
        row[6]?.text,
        row[7]?.text === "—" ? "No answers yet" : row[7]?.text,
      ])}
      title="Practice questions"
      toolbar={
        <>
          <MockSearch placeholder="Search by question or skill…" value={search} />
          <MockSelect>All formats</MockSelect>
          <MockSelect>All languages</MockSelect>
        </>
      }
    />
  );
}
