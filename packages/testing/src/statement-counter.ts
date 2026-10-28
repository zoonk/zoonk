import { strict as assert } from "node:assert";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { createRequire } from "node:module";

export type StatementCounts = { statements: number; writes: number };

const counters = new AsyncLocalStorage<StatementCounts[]>();
/** Resolve the very same pg instance that @zoonk/db's PrismaPg adapter uses. */
const requireDatabaseDependency = createRequire(import.meta.resolve("@zoonk/db"));
type DriverClient = { query: (...args: unknown[]) => unknown };
type DriverPool = { connect: (...args: unknown[]) => unknown };
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Resolve the installed driver's public Client API without adding a second pg dependency.
const { Client, Pool } = requireDatabaseDependency("pg") as {
  Client: { prototype: DriverClient };
  Pool: { prototype: DriverPool };
};

const originalQuery = Client.prototype.query;
const originalConnect = Pool.prototype.connect;

/** pg drains queues in the releaser's context: preserve every submitter, including no counter. */
Pool.prototype.connect = function connect(...args: unknown[]) {
  const [callback, ...rest] = args;

  if (typeof callback === "function") {
    const bound = AsyncResource.bind(function acquired(this: unknown, ...values: unknown[]) {
      const result: unknown = Reflect.apply(callback, this, values);
      return result;
    });

    return Reflect.apply(originalConnect, this, [bound, ...rest]);
  }

  return Reflect.apply(originalConnect, this, args);
};

function isMutatingStatement(statement: string[]): boolean {
  const nesting = { depth: 0 };

  for (const [index, token] of statement.entries()) {
    if (token === "(") {
      nesting.depth += 1;
    } else if (token === ")") {
      nesting.depth -= 1;
    } else if (["INSERT", "UPDATE", "DELETE", "MERGE"].includes(token)) {
      if (index === 0) {
        return true;
      }

      if (statement[0] === "WITH") {
        const followsCTEs = nesting.depth === 0 && statement[index - 1] === ")";

        const startsCTE = /\bAS (?:NOT )?(?:MATERIALIZED )?\($/u.test(
          statement.slice(0, index).join(" "),
        );

        if (followsCTEs || startsCTE) {
          return true;
        }
      }
    }
  }

  return false;
}

function countSQL(text: string): StatementCounts {
  const tokens = text.matchAll(
    /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|(?<delimiter>\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$)[\s\S]*?\k<delimiter>|[A-Za-z_][A-Za-z_0-9$]*|[();]/gu,
  );

  const statements: string[][] = [[]];

  for (const [token] of tokens) {
    if (token === ";") {
      statements.push([]);
    } else if (/^[A-Za-z_(]/u.test(token) || token === ")") {
      statements.at(-1)?.push(token.toUpperCase());
    }
  }

  const nonempty = statements.filter((statement) => statement.length > 0);

  return {
    statements: nonempty.length,
    writes: nonempty.filter((statement) => isMutatingStatement(statement)).length,
  };
}

function queryText(input: unknown): string | null {
  if (typeof input === "string") {
    return input;
  }

  if (
    typeof input === "object" &&
    input !== null &&
    "text" in input &&
    typeof input.text === "string"
  ) {
    return input.text;
  }

  return null;
}

/** Pool reads and checked-out transaction clients both pass through this driver boundary. */
Client.prototype.query = function query(...args: unknown[]) {
  const active = counters.getStore();
  const text = queryText(args[0]);

  if (active && text) {
    const counts = countSQL(text);

    active.forEach((counter) => {
      counter.statements += counts.statements;
      counter.writes += counts.writes;
    });
  }

  return Reflect.apply(originalQuery, this, args);
};

/**
 * Counts BEGIN/COMMIT/ROLLBACK and writes in CTEs too, and nested counters add to their parent.
 * Await all callback work before returning.
 */
export async function countDatabaseStatements<T>(callback: () => Promise<T>) {
  const counts: StatementCounts = { statements: 0, writes: 0 };

  const result = await counters.run([...(counters.getStore() ?? []), counts], async () => {
    /** PrismaPromise executes when awaited: the await must happen inside the counting context. */
    const value = await callback();
    return value;
  });

  return { ...counts, result };
}

/** A capability budget also forbids mutating statements, even ones later rolled back. */
export function assertReadBudget(counts: StatementCounts, maximum: number): void {
  assert.equal(counts.writes, 0, `Expected 0 writes, received ${counts.writes}`);

  assert.ok(
    counts.statements <= maximum,
    `Expected at most ${maximum} statements, received ${counts.statements}`,
  );
}
