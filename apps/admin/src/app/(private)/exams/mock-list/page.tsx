import dump from "@/app/(private)/_mock/data/exams.json";
import { type Dump, Lead, MockList, day, language } from "@/app/(private)/_mock/kit";

const COLUMNS = [
  { label: "Exam" },
  { label: "Country" },
  { label: "Exam date" },
  { align: "right" as const, label: "Goals" },
  { label: "Next check" },
];

const COUNTRIES: Record<string, string> = {
  BR: "Brazil",
  GB: "United Kingdom",
  IN: "India",
  ZZ: "Any country",
};

export default function ExamsMockPage() {
  const rows = (dump as Dump).tables[0]?.rows ?? [];

  return (
    <MockList
      columns={COLUMNS}
      rows={rows.map((row) => [
        <Lead
          key="lead"
          second={[row[2]?.text, row[3]?.text, language(row[4]?.text)]
            .filter((value) => value && value !== "—")
            .join(" · ")}
          title={row[0]?.text}
        />,
        COUNTRIES[row[1]?.text ?? ""] ?? row[1]?.text,
        day(row[6]?.text),
        row[9]?.text,
        row[8]?.text === "—" ? "Not being checked" : day(row[8]?.text),
      ])}
      title="Exams"
    />
  );
}
