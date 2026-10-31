import { type TransactionClient, prisma } from "@zoonk/db";

type FactResults<T extends readonly unknown[]> = { [Index in keyof T]: Awaited<T[Index]> };

/** Pool reads can run together; a transaction has one connection. Keep sibling relation reads separate too: https://github.com/prisma/orm/issues/29407. */
export async function readDatabaseFacts<const T extends readonly unknown[]>(
  client: TransactionClient,
  ...reads: { [Index in keyof T]: () => T[Index] }
): Promise<FactResults<T>> {
  const values: unknown[] = [];

  if (client === prisma) {
    const parallel = await Promise.all(reads.map((read) => read()));
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Promise.all preserves the input tuple's order and result types.
    return parallel as unknown as FactResults<T>;
  }

  for (const read of reads) {
    // oxlint-disable-next-line no-await-in-loop -- Queries sharing a transaction must finish before the next one starts.
    values.push(await read());
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Each result occupies the same position as its typed read callback.
  return values as unknown as FactResults<T>;
}
