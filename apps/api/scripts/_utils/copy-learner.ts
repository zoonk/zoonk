import { prisma, sql } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { isJsonObject, mapJsonStrings } from "@zoonk/utils/json";
import {
  type LearnerColumn,
  type LearnerRow,
  type LearnerTable,
  USERS_TABLE,
  listIds,
  quoteName,
} from "./learner-rows";

const UUID = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/giu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/u;
const ISO_DATE_LENGTH = 10;
const DAYS_PER_WEEK = 7;
const ROWS_PER_INSERT = 500;
const COPY_TIMEOUT_MS = 120_000;

const WRITTEN_AT_COLUMNS = new Set(["created_at", "updated_at"]);
const JSON_TYPES = new Set(["json", "jsonb"]);
const TIME_ZONE_COLUMNS = new Set(["time_zone", "timezone"]);

const WEEKDAY_COLUMNS = new Set(["day_of_week", "weekday"]);

const WEEKDAY_LISTS = new Set(["weekdayMinutes"]);

/**
 * Calendar days move by whole `days`; instants also move by `ms`, the hours that keep their local
 * times in a new time zone, less the hours that would put a write later than now.
 */
export type TimeShift = { days: number; ms: number };

type CopyContext = { ids: ReadonlyMap<string, string>; shift: TimeShift; timeZone?: string };

type CopiedRow = Record<string, unknown>;

/** `timestamp` columns hold UTC instants without a zone. */
function toInstant(value: string, type: string): number {
  return new Date(type === "timestamp without time zone" ? `${value}Z` : value).getTime();
}

export function findLastWrite(learner: LearnerTable[]): Date {
  const times = learner.flatMap((table) => {
    const columns = table.columns.filter((column) => WRITTEN_AT_COLUMNS.has(column.name));

    return table.rows.flatMap((row) =>
      columns.flatMap((column) => {
        const value = row[column.name];
        return typeof value === "string" ? [toInstant(value, column.type)] : [];
      }),
    );
  });

  return new Date(Math.max(...times));
}

function remapIds(text: string, ids: ReadonlyMap<string, string>): string {
  return text.replaceAll(UUID, (id) => ids.get(id.toLowerCase()) ?? id);
}

function shiftDate(date: string, days: number): string {
  return new Date(parseLocalDate(date).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, ISO_DATE_LENGTH);
}

function shiftInstant(instant: string, ms: number): string {
  return new Date(new Date(instant).getTime() + ms).toISOString();
}

function shiftNaiveInstant(instant: string, ms: number): string {
  return shiftInstant(`${instant}Z`, ms).slice(0, -1);
}

const SHIFTS: Partial<Record<string, (value: string, shift: TimeShift) => string>> = {
  date: (value, shift) => shiftDate(value, shift.days),
  "timestamp with time zone": (value, shift) => shiftInstant(value, shift.ms),
  "timestamp without time zone": (value, shift) => shiftNaiveInstant(value, shift.ms),
};

function toWeekday(day: number): number {
  return ((day % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

function rotateWeekdays(value: unknown, days: number): unknown {
  if (!Array.isArray(value) || value.length !== DAYS_PER_WEEK) {
    return value;
  }

  const minutes: unknown[] = value;

  return minutes.map((_, weekday) => minutes[toWeekday(weekday - days)]);
}

function copyJsonText(text: string, copy: CopyContext): string {
  const remapped = remapIds(text, copy.ids);

  if (ISO_DATE.test(remapped)) {
    return shiftDate(remapped, copy.shift.days);
  }

  return ISO_INSTANT.test(remapped) ? shiftInstant(remapped, copy.shift.ms) : remapped;
}

function copyJson(value: unknown, copy: CopyContext): unknown {
  if (typeof value === "string") {
    return copyJsonText(value, copy);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => copyJson(entry, copy));
  }

  if (!isJsonObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      copyJsonText(key, copy),
      WEEKDAY_LISTS.has(key) ? rotateWeekdays(entry, copy.shift.days) : copyJson(entry, copy),
    ]),
  );
}

function copyValue({
  column,
  copy,
  value,
}: {
  column: LearnerColumn;
  copy: CopyContext;
  value: unknown;
}): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (TIME_ZONE_COLUMNS.has(column.name) && copy.timeZone) {
    return copy.timeZone;
  }

  if (WEEKDAY_COLUMNS.has(column.name) && typeof value === "number") {
    return toWeekday(value + copy.shift.days);
  }

  const shiftValue = SHIFTS[column.type];

  if (shiftValue && typeof value === "string") {
    return shiftValue(value, copy.shift);
  }

  if (JSON_TYPES.has(column.type)) {
    return copyJson(value, copy);
  }

  return mapJsonStrings(value, (text) => remapIds(text, copy.ids));
}

function withCopyAccount(row: CopiedRow, account: { email: string; username: string }) {
  return {
    ...row,
    display_username: account.username,
    email: account.email,
    email_verified: true,
    stripe_customer_id: null,
    username: account.username,
  };
}

function orderSelfReferences({
  columns,
  rows,
}: {
  columns: string[];
  rows: CopiedRow[];
}): CopiedRow[] {
  const pending = new Set(rows.map((row) => row.id));
  const ready = rows.filter((row) => columns.every((column) => !pending.has(row[column])));

  if (columns.length === 0 || ready.length === 0 || ready.length === rows.length) {
    return rows;
  }

  const rest = rows.filter((row) => !ready.includes(row));

  return [...ready, ...orderSelfReferences({ columns, rows: rest })];
}

function copyTable({
  account,
  copy,
  table,
}: {
  account: { email: string; username: string };
  copy: CopyContext;
  table: LearnerTable;
}): CopiedRow[] {
  const rows = table.rows.map((row: LearnerRow) =>
    Object.fromEntries(
      table.columns.map((column) => [
        column.name,
        copyValue({ column, copy, value: row[column.name] }),
      ]),
    ),
  );

  if (table.name === USERS_TABLE) {
    return rows.map((row) => withCopyAccount(row, account));
  }

  return orderSelfReferences({ columns: table.selfReferences, rows });
}

/** Ids are time-ordered (UUIDv7), so new ones are given in the old ones' order. */
async function mapIds(learner: LearnerTable[]): Promise<Map<string, string>> {
  const oldIds = learner.flatMap((table) => listIds(table.rows)).toSorted();

  const fresh = await prisma.$queryRaw<{ id: string }[]>(sql`
    SELECT uuidv7()::text AS id FROM generate_series(1, ${oldIds.length}::int) ORDER BY 1
  `);

  return new Map(fresh.flatMap(({ id }, index) => (oldIds[index] ? [[oldIds[index], id]] : [])));
}

function toInserts({ name, rows }: { name: string; rows: CopiedRow[] }) {
  const count = Math.ceil(rows.length / ROWS_PER_INSERT);

  return Array.from({ length: count }, (_, index) => ({
    name,
    rows: rows.slice(index * ROWS_PER_INSERT, (index + 1) * ROWS_PER_INSERT),
  }));
}

export async function writeLearnerCopy({
  account,
  learner,
  shift,
  timeZone,
}: {
  account: { email: string; username: string };
  learner: LearnerTable[];
  shift: TimeShift;
  timeZone?: string;
}): Promise<string> {
  const ids = await mapIds(learner);
  const copy = { ids, shift, timeZone };

  const inserts = learner.flatMap((table) =>
    toInserts({ name: table.name, rows: copyTable({ account, copy, table }) }),
  );

  await prisma.$transaction(
    async (tx) => {
      for (const { name, rows } of inserts) {
        // oxlint-disable-next-line no-await-in-loop -- rows go in after the rows they reference
        await tx.$executeRawUnsafe(
          `INSERT INTO ${quoteName(name)} SELECT * FROM json_populate_recordset(NULL::${quoteName(name)}, $1::json)`,
          JSON.stringify(rows),
        );
      }
    },
    { timeout: COPY_TIMEOUT_MS },
  );

  const userId = learner.find((table) => table.name === USERS_TABLE)?.rows[0]?.id;
  const copyId = typeof userId === "string" ? ids.get(userId) : undefined;

  if (!copyId) {
    throw new Error("The learner to copy wasn't read.");
  }

  return copyId;
}
