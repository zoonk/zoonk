import { AdminFilterNav } from "@/components/admin-filter-nav";
import { AdminToolbar } from "@/components/admin-page";
import { AiMockShell } from "../../_mock/ai-shell";
import { MockLink, MockMore, MockTable } from "../../_mock/parts";

const RUNS = [
  ["Lendo o contrato", "Lesson", "Failed", "Nov 12, 2026, 1:11 PM"],
  ["Como funciona a bolsa", "Lesson", "Failed", "Nov 3, 2026, 7:45 PM"],
  ["Juros simples e compostos", "Lesson", "Stuck for 9 days", "Nov 3, 2026, 7:45 PM"],
  ["Ler um balanço", "Lesson", "Stuck for 9 days", "Nov 3, 2026, 7:45 PM"],
  ["Processo Legislativo", "Course outline", "Stuck for 30 days", "Oct 13, 2026, 9:40 PM"],
  [
    "Ética Profissional e Estatuto da Advocacia",
    "Course outline",
    "Stuck for 30 days",
    "Oct 13, 2026, 9:39 PM",
  ],
  ["Direitos Humanos", "Course outline", "Stuck for 30 days", "Oct 13, 2026, 9:39 PM"],
  ["Direito Tributário", "Course outline", "Stuck for 30 days", "Oct 13, 2026, 9:39 PM"],
  [
    "Vias processuais do controle de constitucionalidade",
    "Chapter outline",
    "Stuck for 34 days",
    "Oct 9, 2026, 8:33 PM",
  ],
  [
    "Prazos para constituir e cobrar o crédito",
    "Chapter outline",
    "Stuck for 34 days",
    "Oct 9, 2026, 5:09 PM",
  ],
] as const;

export default function AiFailedMockPage() {
  return (
    <AiMockShell current="failed">
      <AdminToolbar>
        <AdminFilterNav
          label="Kind"
          options={[
            { count: 40, href: "#all", isActive: true, label: "All" },
            { count: 27, href: "#lesson", isActive: false, label: "Lessons" },
            { count: 8, href: "#course", isActive: false, label: "Course outlines" },
            { count: 5, href: "#chapter", isActive: false, label: "Chapter outlines" },
          ]}
        />
      </AdminToolbar>

      <MockTable
        columns={[
          { label: "What was being written" },
          { label: "Kind" },
          { label: "State" },
          { label: "Started" },
        ]}
        rows={RUNS.map(([content, kind, state, started]) => ({
          cells: [
            <span className="text-foreground" key={content}>
              <MockLink>{content}</MockLink>
            </span>,
            kind,
            <span
              className={state === "Failed" ? "text-destructive-text font-medium" : undefined}
              key="state"
            >
              {state}
            </span>,
            started,
          ],
          key: content,
        }))}
      />
      <MockMore>Show all 40</MockMore>
    </AiMockShell>
  );
}
