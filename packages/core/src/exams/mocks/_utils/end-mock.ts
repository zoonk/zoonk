import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { type MockConditions } from "../mock-contract";
import { completeMock } from "./complete-mock";
import { type MockSitting, type OwnedMock, findMockSitting } from "./owned-mock";

const FINISH_LOCK_NAMESPACE = 51_881;

const FINISH_TIMEOUT_MS = 300_000;

async function lockMockFinish(tx: TransactionClient, mockId: string): Promise<void> {
  await tx.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${FINISH_LOCK_NAMESPACE}::int, hashtext(${mockId}))::text`,
  );
}

/** A failed finish may commit some answers; retrying records only the remaining ones. */
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
}): Promise<"expired" | "finished" | "notRunning"> {
  return prisma.$transaction(
    async (tx) => {
      await lockMockFinish(tx, mock.id);

      const current = await findMockSitting(tx, mock.id);

      if (current?.status !== "active") {
        return current?.status === "finished" || current?.status === "expired"
          ? current.status
          : "notRunning";
      }

      const handedIn = conditions.sections.length;
      const isStuck = current.sectionIndex >= handedIn;

      if (!isStuck) {
        // Outside the lock's transaction: grading updates this row too, and must not wait on it.
        const count = await writeLearnerChange({ userId: mock.userId }, async (writing) => {
          const updated = await writing.mockExam.updateMany({
            data: { conditions, sectionIndex: handedIn },
            where: { id: mock.id, sectionIndex: mock.sectionIndex, status: "active" },
          });

          return updated.count > 0 ? updated.count : unchanged(updated.count);
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
