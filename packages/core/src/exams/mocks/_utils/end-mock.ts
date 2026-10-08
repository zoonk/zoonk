import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { type MockConditions } from "../mock-contract";
import { completeMock } from "./complete-mock";
import { type MockSitting, type OwnedMock, findMockSitting } from "./owned-mock";

/** Namespaces the per-mock finish lock so it never collides with other advisory locks. */
const FINISH_LOCK_NAMESPACE = 51_881;

/**
 * A full exam day records each answer in turn while the lock is held, and a second finish waits
 * that long; both fit in the longest a request may run.
 */
const FINISH_TIMEOUT_MS = 300_000;

/**
 * Serializes the finishes of one mock (a second tap, another tab, the last section's clock), so
 * the one that waited finds the mock graded instead of grading it again.
 */
async function lockMockFinish(tx: TransactionClient, mockId: string): Promise<void> {
  await tx.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${FINISH_LOCK_NAMESPACE}::int, hashtext(${mockId}))::text`,
  );
}

/**
 * Hands the mock in and grades it, exactly once: its section index moves past the last section,
 * then every answer is recorded, under a per-mock lock. The lock's transaction only holds the
 * lock; the writes commit as they go, so a finish that fails halfway leaves the mock handed in
 * with some answers recorded, frees the lock at once, and the next try grades the rest (each
 * answer is recorded once). "notRunning" means another request moved the mock on first.
 */
export async function endMock({
  conditions,
  mock,
  owned,
  timeZone,
}: {
  conditions: MockConditions;
  mock: MockSitting;
  owned: OwnedMock;
  timeZone: string;
}): Promise<"finished" | "notRunning"> {
  return prisma.$transaction(
    async (tx) => {
      await lockMockFinish(tx, mock.id);

      const current = await findMockSitting(tx, mock.id);

      if (current?.status !== "active") {
        return current?.status === "finished" ? "finished" : "notRunning";
      }

      const handedIn = conditions.sections.length;
      const isStuck = current.sectionIndex >= handedIn;

      if (!isStuck) {
        // Outside the lock's transaction: grading updates this row too, and must not wait on it.
        const { count } = await prisma.mockExam.updateMany({
          data: { conditions, sectionIndex: handedIn },
          where: { id: mock.id, sectionIndex: mock.sectionIndex, status: "active" },
        });

        if (count === 0) {
          return "notRunning";
        }
      }

      await completeMock({
        mock: {
          ...current,
          conditions: isStuck ? current.conditions : conditions,
          sectionIndex: handedIn,
        },
        owned,
        timeZone,
      });

      return "finished";
    },
    { timeout: FINISH_TIMEOUT_MS },
  );
}
