import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { completeBlockMoment } from "./_utils/block-completion";
import { readBlockPayload } from "./block-payload";
import { getStudySession } from "./get-study-session";
import { oweDaySettlement } from "./settle-owed-session-day";

const RESULT = {
  brainPower: 0,
  capsulesOpened: 0,
  checkpoint: null,
  comesBackOn: null,
  correct: 0,
  netScore: null,
  testOutOffer: null,
  topHyperdrive: 0,
  total: 0,
};

describe("the settled completion queue", () => {
  it("includes an append committed while settlement waits and agrees with the full session view", async () => {
    freezeClock();
    const user = await userFixture();
    mockSession(user.id);

    const session = await studySessionFixture({
      localDate: toUTCMidnight(new Date()),
      status: "active",
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      completedAt: new Date(),
      kind: "review",
      sessionId: session.id,
      status: "completed",
    });

    const lock = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.studySessionBlock.create({
          data: { kind: "practice", position: 1, sessionId: session.id },
        }),
      userId: user.id,
    });

    const pid = await lock.pid;

    const finishing = completeBlockMoment({
      blockId: block.id,
      brainPowerBefore: 0,
      energy: null,
      payload: readBlockPayload(block),
      result: RESULT,
      sessionId: session.id,
      timeZone: "UTC",
      userId: user.id,
    });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      lock.release();
    }

    await lock.done;
    const completion = await finishing;
    expect(completion.blocks).toHaveLength(2);
    expect(completion.next?.block.kind).toBe("practice");
    expect(completion.nextBlockId).toBe(completion.next?.block.id);
    expect(completion.sessionBar).toStrictEqual({ completed: 1, total: 2 });
    expect(completion.sessionCompleted).toBe(false);
    const view = await getStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });
    expect(view.status === "ready" && view.session.blocks).toStrictEqual(completion.blocks);
  });

  it("owes one session refresh when several block completions commit, and owes none after rollback", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ userId: user.id });

    const blocks = await Promise.all(
      [0, 1].map((position) => studySessionBlockFixture({ position, sessionId: session.id })),
    );

    await Promise.all(
      blocks.map((block) =>
        prisma.$transaction((tx) =>
          oweDaySettlement(tx, { block, timeZone: "UTC", userId: user.id }),
        ),
      ),
    );

    await expect(
      prisma.followUp.count({
        where: { key: session.id, kind: "refreshStudyDay", userId: user.id },
      }),
    ).resolves.toBe(1);

    const before = await prisma.followUp.findFirstOrThrow({
      where: { kind: "refreshStudyDay", userId: user.id },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await oweDaySettlement(tx, { block: blocks[0]!, timeZone: "UTC", userId: user.id });
        throw new Error("Roll back completion");
      }),
    ).rejects.toThrow("Roll back completion");

    await expect(prisma.followUp.findUnique({ where: { id: before.id } })).resolves.toStrictEqual(
      before,
    );
  });
});
