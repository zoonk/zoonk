import daily from "@/app/(private)/_mock/data/ai-daily.json";
import dump from "@/app/(private)/_mock/data/ai.json";
import { type Cell, type Dump, MockRows, parts, readView } from "@/app/(private)/_mock/kit";
import { AdminToolbar } from "@/components/admin-page";
import { AdminSection } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { Stats } from "@/components/stats";
import { AiMockShell } from "../../_mock/ai-shell";
import { MockLink, MockMore } from "../../_mock/parts";
import { AiDailySpendChart } from "../ai-daily-spend-chart";

const ai = dump as Dump;
const SHOWN = 8;
const RIGHT = "right" as const;

/** A column of money says no money as an amount, so every row ends in digits. */
function money(text = "") {
  return text === "Nothing" ? "$0.00" : text;
}

function table(section: string, index = 0): Cell[][] {
  return ai.tables.filter((item) => item.section === section)[index]?.rows ?? [];
}

function words(code: string | undefined): string {
  const text = (code ?? "").replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function strong(text: string | undefined) {
  return <span className="text-foreground font-medium">{text}</span>;
}

const BY = {
  goal: {
    columns: [
      { label: "Goal" },
      { label: "Learner", size: "text" as const },
      { align: RIGHT, label: "Calls" },
      { align: RIGHT, label: "Cost" },
    ],
    more: "goals",
    rows: () =>
      table("Top goals").map((row) => [
        strong(row[0]?.text),
        row[1]?.text,
        row[2]?.text,
        row[3]?.text,
      ]),
  },
  learner: {
    columns: [
      { label: "Learner", size: "text" as const },
      { align: RIGHT, label: "Calls" },
      { align: RIGHT, label: "Cost" },
    ],
    more: "learners",
    rows: () =>
      table("Top learners").map((row) => [
        <span className="block" key="who">
          {strong(parts(row[0])[0])}
          <span className="text-muted-foreground block text-xs">{parts(row[0])[1]}</span>
        </span>,
        row[1]?.text,
        row[2]?.text,
      ]),
  },
  model: {
    columns: [
      { label: "Model", size: "wide" as const },
      { align: RIGHT, label: "Calls" },
      { align: RIGHT, label: "Input" },
      { align: RIGHT, label: "Output" },
      { align: RIGHT, label: "Cost" },
    ],
    more: "models",
    rows: () =>
      table("Spend by model").map((row) => [
        <span className="block" key="model">
          {strong(row[0]?.text)}
          <span className="text-muted-foreground block text-xs">{words(row[1]?.text)}</span>
        </span>,
        row[2]?.text,
        row[3]?.text,
        row[5]?.text,
        row[6]?.text,
      ]),
  },
  task: {
    columns: [
      { label: "Task" },
      { align: RIGHT, label: "Calls" },
      { align: RIGHT, label: "Cost" },
      { align: RIGHT, label: "Per call" },
      { align: RIGHT, label: "Typical time" },
    ],
    more: "tasks",
    rows: () =>
      table("Spend by task").map((row) => [
        strong(words(row[0]?.text)),
        row[1]?.text,
        row[2]?.text,
        row[3]?.text,
        row[7]?.text,
      ]),
  },
};

type By = keyof typeof BY;

function Spend({ by }: { by: By }) {
  const view = BY[by];
  const rows = view.rows();

  return (
    <>
      <AdminToolbar>
        <AdminTabs
          label="Period"
          options={[
            { href: "#7", isActive: false, label: "7 days" },
            { href: "#30", isActive: true, label: "30 days" },
            { href: "#90", isActive: false, label: "90 days" },
          ]}
        />
      </AdminToolbar>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stats description="Gateway estimates $81.22" title="Spend" value="$81.09" />
        <Stats title="Calls" value="24,744" />
        <Stats title="Cost per call" value="$0.0033" />
        <Stats description="15M of 78.6M input tokens" title="Read from cache" value="19%" />
      </div>

      <AiDailySpendChart points={daily} />

      <AdminSection
        action={
          <AdminTabs
            label="Spend by"
            options={(["task", "model", "goal", "learner"] as const).map((key) => ({
              href: `/ai/mock?by=${key}`,
              isActive: key === by,
              label: words(key),
            }))}
          />
        }
        title="Where it went"
      >
        <MockRows columns={view.columns} rows={rows.slice(0, SHOWN)} />
        <MockMore>
          Show all {rows.length} {view.more}
        </MockMore>
      </AdminSection>
    </>
  );
}

const DAY_MS = 86_400_000;

function state(row: Cell[]) {
  if (row[2]?.text === "Failed") {
    return <span className="text-destructive-text font-medium">Failed</span>;
  }

  const days = Math.ceil((Date.parse("2026-11-12") - Date.parse(row[3]?.text ?? "")) / DAY_MS);
  return `Stuck for ${days} days`;
}

function Failed() {
  const totals = table("Generation failures");
  const runs = table("Generation failures", 1);

  return (
    <>
      <AdminToolbar>
        <AdminTabs
          label="Kind"
          options={[
            { count: 40, href: "#all", isActive: true, label: "All" },
            ...totals
              .filter((row) => Number(row[1]?.text) + Number(row[2]?.text) > 0)
              .map((row) => ({
                count: Number(row[1]?.text) + Number(row[2]?.text),
                href: `#${row[0]?.text}`,
                isActive: false,
                label: row[0]?.text ?? "",
              })),
          ]}
        />
      </AdminToolbar>

      <MockRows
        columns={[
          { label: "What was being written" },
          { label: "Kind", size: "wide" as const },
          { label: "State", size: "wide" as const },
          { label: "Updated", size: "wide" as const },
        ]}
        rows={runs.slice(0, 10).map((row) => [
          <span className="text-foreground" key="what">
            <MockLink>{row[1]?.text}</MockLink>
          </span>,
          row[0]?.text,
          state(row),
          row[3]?.text,
        ])}
      />
      <MockMore>Show all 40</MockMore>
    </>
  );
}

function Plus() {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stats description="1 paying" title="Plus learners" value="83" />
        <Stats description="$0.0095 a learner on average" title="Cost this month" value="$0.785" />
        <Stats description="of 1 paying" title="Above their plan" value="0" />
        <Stats
          description="persona-maya-2acb17@zoonk.test"
          title="Most expensive"
          value="$0.2568"
        />
      </div>

      <AdminSection title="Plus learners this month">
        <MockRows
          columns={[
            { label: "Plan", size: "wide" as const },
            { align: RIGHT, label: "Learners" },
            { align: RIGHT, label: "Pays a month" },
            { align: RIGHT, label: "Cost" },
            { align: RIGHT, label: "Average" },
            { align: RIGHT, label: "Most" },
            { align: RIGHT, label: "Above plan" },
          ]}
          rows={table("Plus learners this month").map((row) =>
            row.map((cell, index) =>
              index === 0
                ? strong(cell.text.replace("Granted", "Given by Zoonk"))
                : money(cell.text),
            ),
          )}
        />
      </AdminSection>

      <AdminSection title="Plus learners by cost">
        <MockRows
          columns={[
            { label: "Learner", size: "text" as const },
            { label: "Plan", size: "wide" as const },
            { label: "Goals", size: "long" as const },
            { align: RIGHT, label: "Calls" },
            { align: RIGHT, label: "Cost" },
            { align: RIGHT, label: "Pays a month" },
          ]}
          rows={table("Plus learners by cost").map((row) => [
            <span className="block" key="who">
              {strong(parts(row[0])[0])}
              <span className="text-muted-foreground block text-xs">{parts(row[0])[1]}</span>
            </span>,
            row[1]?.text.replace("Granted", "Given by Zoonk"),
            <span className="block whitespace-normal" key="goal">
              {row[2]?.text}
            </span>,
            row[3]?.text,
            row[4]?.text,
            money(row[5]?.text),
          ])}
        />
      </AdminSection>
    </>
  );
}

function WrittenBy() {
  const rows = table("What each model wrote");

  return (
    <AdminSection title="What each model wrote">
      <MockRows
        columns={[
          { label: "What" },
          { label: "Model", size: "wide" as const },
          { label: "Prompt version", size: "wide" as const },
          { align: RIGHT, label: "How many" },
        ]}
        rows={rows
          .slice(0, SHOWN)
          .map((row) => [strong(row[0]?.text), row[1]?.text, row[2]?.text, row[3]?.text])}
      />
      <MockMore>Show all {rows.length}</MockMore>
    </AdminSection>
  );
}

export default async function AiMockPage({ searchParams }: PageProps<"/ai/mock">) {
  const query = await searchParams;
  const tab = readView(query.tab) || "spend";
  const by = readView(query.by);

  return (
    <AiMockShell current={tab}>
      {tab === "failed" ? <Failed /> : null}
      {tab === "plus" ? <Plus /> : null}
      {tab === "written" ? <WrittenBy /> : null}
      {tab === "spend" ? <Spend by={by in BY ? (by as By) : "task"} /> : null}
    </AiMockShell>
  );
}
