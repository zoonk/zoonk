import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceChangeNoticeFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { listGoalChangeNotices, recordSourceChangeNotice } from "./source-change-notices";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

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

    // The goal's own research read a new edition six minutes in; the plan stopped waiting at ten.
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

describe(recordSourceChangeNotice, () => {
  it("stores the line with the model that wrote it", async () => {
    const source = await sourceFixture();

    const notice = await recordSourceChangeNotice({
      contentHash: "new",
      fields: ["text"],
      language: "en",
      message: "The documentation changed: version 5 removed the old API.",
      previousHash: source.contentHash,
      provenance: {
        generatedAt: "2026-09-26T12:00:00.000Z",
        model: "openai/gpt-6-luna",
        promptVersion: "v1",
        runId: "r1",
      },
      sourceId: source.id,
    });

    expect(notice).toMatchObject({
      examBlueprintId: null,
      generatedAt: new Date("2026-09-26T12:00:00.000Z"),
      model: "openai/gpt-6-luna",
      sourceId: source.id,
    });
  });
});
