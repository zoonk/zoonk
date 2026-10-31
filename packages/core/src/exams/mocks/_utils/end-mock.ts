import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { type MockConditions } from "../mock-contract";
import { completeMock } from "./complete-mock";
import { type MockSitting, type OwnedMock, findMockSitting } from "./owned-mock";

/**
 * Far longer than a hand-in takes, so an older claim belongs to a request that died. If one still
 * runs, attempts are unique per mock and item: the second grader fails instead of grading twice.
 */
const HAND_IN_LEASE_MS = 300_000;

const CLAIM_POLL_MS = 250;

type ClaimedMock = MockSitting & { handInClaimedAt: Date };

async function claimHandIn({
  conditions,
  current,
  mock,
}: {
  conditions: MockConditions;
  current: MockSitting;
  mock: MockSitting;
}): Promise<ClaimedMock | null> {
  const handedIn = conditions.sections.length;
  const now = new Date();

  if (current.sectionIndex >= handedIn) {
    const { count } = await prisma.mockExam.updateMany({
      data: { handInClaimedAt: now },
      where: {
        OR: [
          { handInClaimedAt: null },
          { handInClaimedAt: { lt: new Date(now.getTime() - HAND_IN_LEASE_MS) } },
        ],
        id: mock.id,
        status: "active",
      },
    });

    return count > 0 ? { ...current, handInClaimedAt: now } : null;
  }

  const count = await writeLearnerChange({ userId: mock.userId }, async (tx) => {
    const updated = await tx.mockExam.updateMany({
      data: { conditions, handInClaimedAt: now, sectionIndex: handedIn },
      where: { id: mock.id, sectionIndex: mock.sectionIndex, status: "active" },
    });

    return updated.count > 0 ? updated.count : unchanged(updated.count);
  });

  return count > 0
    ? { ...current, conditions, handInClaimedAt: now, sectionIndex: handedIn }
    : null;
}

/**
 * One request grades a hand-in; duplicates wait for its result without holding a database
 * connection. A failed finish may commit some answers; retrying records only the remaining ones.
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
}): Promise<"expired" | "finished" | "notRunning"> {
  const current = await findMockSitting(prisma, mock.id);

  if (current?.status !== "active") {
    return current?.status === "finished" || current?.status === "expired"
      ? current.status
      : "notRunning";
  }

  if (
    current.sectionIndex < conditions.sections.length &&
    current.sectionIndex !== mock.sectionIndex
  ) {
    return "notRunning";
  }

  const claimed = await claimHandIn({ conditions, current, mock });

  if (!claimed) {
    await wait(CLAIM_POLL_MS);
    return endMock({ conditions, mock, owned, timeZone });
  }

  const { error } = await safeAsync(() => completeMock({ mock: claimed, owned, timeZone }));

  if (error) {
    await prisma.mockExam.updateMany({
      data: { handInClaimedAt: null },
      where: { handInClaimedAt: claimed.handInClaimedAt, id: mock.id },
    });

    throw error;
  }

  return "finished";
}
