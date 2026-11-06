import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceChangeNoticeFixture,
  sourceFixture,
  unnoticedSourceChangeFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  listGoalChangeNotices,
  recordFailedSourceNotice,
  recordSourceChangeNotice,
} from "./source-change-notices";
import { getOwedSourceChange } from "./unnoticed-changes";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

describe(listGoalChangeNotices, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lists recent changes to the goal's exam and linked sources made after the goal started", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);

    const [source, lawSource, otherSource] = await Promise.all([
      sourceFixture(),
      sourceFixture(),
      sourceFixture(),
    ]);

    const [blueprint, otherBlueprint] = await Promise.all([
      examBlueprintFixture({ sourceId: source.id }),
      examBlueprintFixture({ sourceId: otherSource.id }),
    ]);

    const goal = await goalFixture({
      createdAt: new Date(Date.now() - 5 * DAY_MS),
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: lawSource.id,
      userId: user.id,
    });

    const [, examNotice, lawNotice] = await Promise.all([
      sourceChangeNoticeFixture({
        createdAt: new Date(Date.now() - 6 * DAY_MS),
        examBlueprintId: blueprint.id,
        message: "Before the goal started",
        sourceId: source.id,
      }),
      sourceChangeNoticeFixture({
        createdAt: new Date(Date.now() - DAY_MS),
        examBlueprintId: blueprint.id,
        sourceId: source.id,
      }),
      sourceChangeNoticeFixture({
        message: "The law changed: the rate is now 17%.",
        sourceId: lawSource.id,
      }),
      sourceChangeNoticeFixture({ examBlueprintId: otherBlueprint.id, sourceId: otherSource.id }),
    ]);

    await expect(listGoalChangeNotices({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unauthorized",
    });

    mockSession(user.id);

    const result = await listGoalChangeNotices({ goalId: goal.id });

    expect(result.status === "ready" && result.notices.map((notice) => notice.id)).toStrictEqual([
      lawNotice.id,
      examNotice.id,
    ]);

    mockSession(other.id);

    await expect(listGoalChangeNotices({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("leaves out a notice read while the new goal's plan waited for it: it shaped that plan", async () => {
    const [user, source] = await Promise.all([userFixture(), sourceFixture()]);
    const blueprint = await examBlueprintFixture({ sourceId: source.id });

    const goal = await goalFixture({
      createdAt: new Date(Date.now() - 20 * MINUTE_MS),
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      noticeWaitEndedAt: new Date(Date.now() - 10 * MINUTE_MS),
    });

    const [, news] = await Promise.all([
      sourceChangeNoticeFixture({
        createdAt: new Date(Date.now() - 14 * MINUTE_MS),
        examBlueprintId: blueprint.id,
        message: "The exam notice changed: the test is now on 17 January.",
        sourceId: source.id,
      }),
      sourceChangeNoticeFixture({
        createdAt: new Date(Date.now() - MINUTE_MS),
        examBlueprintId: blueprint.id,
        message: "The exam notice changed: the test now has 100 questions.",
        sourceId: source.id,
      }),
    ]);

    mockSession(user.id);
    const result = await listGoalChangeNotices({ goalId: goal.id });

    expect(result.status === "ready" && result.notices.map((notice) => notice.id)).toStrictEqual([
      news.id,
    ]);
  });
});

const DOCS_NOTICE = {
  contentHash: "new",
  fields: ["text"],
  language: "en",
  message: "The documentation changed: version 5 removed the old API.",
  provenance: {
    generatedAt: "2026-09-26T12:00:00.000Z",
    model: "openai/gpt-6-luna",
    promptVersion: "v1",
    runId: "r1",
  },
};

describe(recordSourceChangeNotice, () => {
  it("stores the line with the model that wrote it", async () => {
    const source = await sourceFixture();
    const owed = await unnoticedSourceChangeFixture({ sourceId: source.id });

    const notice = await recordSourceChangeNotice({ ...DOCS_NOTICE, ...owed, sourceId: source.id });

    expect(notice).toMatchObject({
      examBlueprintId: null,
      generatedAt: new Date("2026-09-26T12:00:00.000Z"),
      model: "openai/gpt-6-luna",
      sourceId: source.id,
    });

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ unnoticedChangedAt: null, unnoticedChanges: null });
  });

  it("covers a change once, and leaves a newer change owed, though it reads the same at the same millisecond", async () => {
    const source = await sourceFixture();
    const owed = await unnoticedSourceChangeFixture({ sourceId: source.id });

    const newer = await unnoticedSourceChangeFixture({ ...owed, sourceId: source.id });

    const covering = { ...DOCS_NOTICE, sourceId: source.id };

    await expect(recordSourceChangeNotice({ ...covering, ...owed })).resolves.toBeNull();

    const [first, second] = await Promise.all([
      recordSourceChangeNotice({ ...covering, ...newer }),
      recordSourceChangeNotice({ ...covering, ...newer }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);

    await expect(prisma.sourceChangeNotice.count({ where: { sourceId: source.id } })).resolves.toBe(
      1,
    );
  });

  it("counts a failed notice run once, and stops trying after three until the page changes", async () => {
    const source = await sourceFixture();
    const { revision } = await unnoticedSourceChangeFixture({ sourceId: source.id });
    const failed = { revision, sourceId: source.id };

    const readOwed = async () =>
      getOwedSourceChange(await prisma.source.findUniqueOrThrow({ where: { id: source.id } }));

    for (const noticeFailures of [0, 1, 2]) {
      // oxlint-disable-next-line no-await-in-loop -- Each failure is counted from the one before.
      await Promise.all([
        recordFailedSourceNotice({ ...failed, noticeFailures }),
        recordFailedSourceNotice({ ...failed, noticeFailures }),
      ]);
    }

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ noticeFailures: 3 });

    await expect(readOwed()).resolves.toBeNull();
  });
});
