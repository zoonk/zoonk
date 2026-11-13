import {
  ADMIN_TOOLBAR_SEARCH_CLASS,
  AdminPage,
  AdminPageBody,
  AdminPageHeader,
  AdminToolbar,
} from "@/components/admin-page";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
// Review-pack mocks only: static pictures of proposed pages, built from the shared components and
// from the records today's pages show (`data/*.json`). Remove with the rest of `_mock`.
import { AdminTabs } from "@/components/admin-tabs";
import { DetailField, DetailFields } from "@/components/detail-field";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { TableCell } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronDownIcon, Search } from "lucide-react";

export type Cell = { href?: string; img?: string; text: string };
export type Dump = {
  fields: { href?: string; label: string; section: string; value: string }[];
  headings: string[];
  tables: { head: string[]; rows: Cell[][]; section: string }[];
  text: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "10/25/2026" as "Oct 25, 2026"; anything else as it is. */
export function day(value: string | undefined): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/u.exec(value ?? "");
  return match ? `${MONTHS[Number(match[1]) - 1]} ${Number(match[2])}, ${match[3]}` : (value ?? "");
}

const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish", pt: "Portuguese" };

export function language(code: string | undefined): string {
  return LANGUAGES[(code ?? "").toLowerCase()] ?? code ?? "";
}

export function parts(cell: Cell | undefined): string[] {
  return (cell?.text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function field(dump: Dump, label: string, section?: string): string {
  return (
    dump.fields.find((item) => item.label === label && (!section || item.section === section))
      ?.value ?? ""
  );
}

/** A row's first cell: what it is, then one quiet line that tells it from its neighbors. */
export function Lead({ second, title }: { second?: React.ReactNode; title: React.ReactNode }) {
  return (
    <a className="block" data-slot="table-row-link" href="#">
      <span className="line-clamp-2 max-w-xl font-medium">{title}</span>
      {second ? (
        <span className="text-muted-foreground block truncate text-xs">{second}</span>
      ) : null}
    </a>
  );
}

export function Quiet({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export function MockSearch({ placeholder, value }: { placeholder: string; value?: string }) {
  return (
    <div className="relative w-full sm:max-w-md">
      <Search
        aria-hidden="true"
        className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2 md:left-2.5 md:size-3.5"
      />
      <Input
        className={ADMIN_TOOLBAR_SEARCH_CLASS}
        defaultValue={value}
        placeholder={placeholder}
        type="search"
      />
    </div>
  );
}

export function MockSelect({ children, field }: { children: React.ReactNode; field?: boolean }) {
  return (
    <Button
      className={field ? "w-full justify-between font-normal" : undefined}
      size={field ? "lg" : "sm"}
      variant="outline"
    >
      {children}
      <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
    </Button>
  );
}

export type MockView = { active?: boolean; count?: number; label: string };

export function MockViews({ label, views }: { label: string; views: MockView[] }) {
  return (
    <AdminTabs
      label={label}
      options={views.map((view) => ({
        count: view.count,
        href: `#${view.label}`,
        isActive: Boolean(view.active),
        label: view.label,
      }))}
    />
  );
}

export type MockColumn = AdminTableColumn;

export function MockRows({
  columns,
  empty = "",
  rows,
}: {
  columns: MockColumn[];
  empty?: string;
  rows: React.ReactNode[][];
}) {
  return (
    <AdminTableColumns columns={columns} emptyLabel={empty} isEmpty={rows.length === 0}>
      {rows.map((row, rowIndex) => (
        // oxlint-disable-next-line react/no-array-index-key -- A static mock table.
        <AdminTableRow key={rowIndex}>
          {row.map((cell, index) => (
            <TableCell
              className={cn(
                index === 0 && "whitespace-normal",
                columns[index]?.align === "right" && "text-right tabular-nums",
                index > 0 && "text-muted-foreground",
              )}
              // oxlint-disable-next-line react/no-array-index-key -- A static mock table.
              key={index}
            >
              {cell}
            </TableCell>
          ))}
        </AdminTableRow>
      ))}
    </AdminTableColumns>
  );
}

/** A list or queue page: title, one toolbar row, the table. */
export function MockList({
  actions,
  children,
  columns,
  empty,
  rows,
  title,
  toolbar,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  columns: MockColumn[];
  empty?: string;
  rows: React.ReactNode[][];
  title: string;
  toolbar?: React.ReactNode;
}) {
  return (
    <AdminPage>
      <AdminPageHeader actions={actions} title={title}>
        {children}
      </AdminPageHeader>
      <AdminPageBody>
        {toolbar ? <AdminToolbar>{toolbar}</AdminToolbar> : null}
        <MockRows columns={columns} empty={empty} rows={rows} />
      </AdminPageBody>
    </AdminPage>
  );
}

/** Label and value rows, each `[label, value]`; rows with no value are left out. */
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <DetailFields>
      {rows
        .filter(([, value]) => value !== "" && value !== null && value !== undefined)
        .map(([label, value]) => (
          <DetailField key={label} label={label}>
            {value}
          </DetailField>
        ))}
    </DetailFields>
  );
}

export function readView(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const NONE = <span className="text-faint">None</span>;

/** Every field of one section of today's page, renamed where the proposal renames it. */
export function FactsFrom({
  dump,
  omit = [],
  rename = {},
  section,
  sizes = {},
}: {
  dump: Dump;
  omit?: string[];
  rename?: Record<string, string>;
  section: string;
  /** A column's size by its label, where its facts are longer than a short one's. */
  sizes?: Record<string, MockColumn["size"]>;
}) {
  return (
    <Facts
      rows={dump.fields
        .filter((item) => item.section === section && !omit.includes(item.label))
        .map((item) => [rename[item.label] ?? item.label, item.value === "—" ? NONE : item.value])}
    />
  );
}

/** One table of today's page, with its headers renamed and some columns left out. */
export function TableFrom({
  dump,
  omit = [],
  rename = {},
  section,
  sizes = {},
}: {
  dump: Dump;
  omit?: string[];
  rename?: Record<string, string>;
  section: string;
  /** A column's size by its label, where its facts are longer than a short one's. */
  sizes?: Record<string, MockColumn["size"]>;
}) {
  const table = dump.tables.find((item) => item.section.startsWith(section));
  const keep = (table?.head ?? [])
    .map((label, index) => ({ index, label }))
    .filter(({ label }) => !omit.includes(label));

  return (
    <MockRows
      columns={keep.map(({ label }) => ({
        label: rename[label] ?? label,
        size: sizes[rename[label] ?? label],
      }))}
      rows={(table?.rows ?? []).map((row) =>
        keep.map(({ index }, position) =>
          position === 0 ? (
            <Lead key="lead" title={row[index]?.text} />
          ) : (
            language(row[index]?.text)
          ),
        ),
      )}
    />
  );
}
