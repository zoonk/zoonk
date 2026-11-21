import "server-only";
import { setTimeout as wait } from "node:timers/promises";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { type MockConditions } from "../mock-contract";
import { completeMock } from "./complete-mock";
import {
  type MockSitting,
  type OwnedMock,
  findMockSitting,
  getSectionDeadline,
} from "./owned-mock";

/**
 * Far longer than a hand-in takes, so an older claim belongs to a request that died. If one still
 * runs, attempts are unique per mock and item: the second grader fails instead of grading twice.
 */
const HAND_IN_LEASE_MS = 300_000;

const CLAIM_POLL_MS = 250;

type ClaimedMock = MockSitting & { handInClaimedAt: Date };

export function withSectionTimeout({
  mock,
  now,
}: {
  mock: MockSitting;
  now: Date;
}): MockConditions {
  const { conditions, sectionIndex } = mock;

  const timedOut =
    sectionIndex < conditions.sections.length &&
    now.getTime() >= getSectionDeadline(mock).getTime();

  return timedOut
    ? { ...conditions, timedOutSections: [...conditions.timedOutSections, sectionIndex] }
    : conditions;
}

async function claimHandIn(current: MockSitting): Promise<ClaimedMock | null> {
  const handedIn = current.conditions.sections.length;
  const now = new Date();

  if (current.sectionIndex >= handedIn) {
    const { count } = await prisma.mockExam.updateMany({
      data: { handInClaimedAt: now },
      where: {
        OR: [
          { handInClaimedAt: null },
          { handInClaimedAt: { lt: new Date(now.getTime() - HAND_IN_LEASE_MS) } },
        ],
        id: current.id,
        status: "active",
      },
    });

    return count > 0 ? { ...current, handInClaimedAt: now } : null;
  }

  return writeLearnerChange({ userId: current.userId }, async (tx) => {
    const locked = await findMockSitting(tx, current.id);

    if (locked?.status !== "active" || locked.sectionIndex !== current.sectionIndex) {
      return unchanged(null);
    }

    const conditions = withSectionTimeout({ mock: locked, now });

    await tx.mockExam.update({
      data: { conditions, handInClaimedAt: now, sectionIndex: handedIn },
      where: { id: locked.id },
    });

    return { ...locked, conditions, handInClaimedAt: now, sectionIndex: handedIn };
  });
}

/**
 * One request grades a hand-in; duplicates wait for its result without holding a database
 * connection. A failed finish may commit some answers; retrying records only the remaining ones.
 */
export async function endMock({
  mock,
  owned,
  timeZone,
}: {
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
    current.sectionIndex < current.conditions.sections.length &&
    current.sectionIndex !== mock.sectionIndex
  ) {
    return "notRunning";
  }

  const claimed = await claimHandIn(current);

  if (!claimed) {
    await wait(CLAIM_POLL_MS);
    return endMock({ mock, owned, timeZone });
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
