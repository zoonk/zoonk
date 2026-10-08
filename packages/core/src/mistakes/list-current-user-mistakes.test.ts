import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { mistakeListInputSchema } from "./contract";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const query = (input: object = {}) => mistakeListInputSchema.parse(input);

describe(listCurrentUserMistakes, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(listCurrentUserMistakes(query())).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("lists only the learner's own mistakes, newest first, with their snapshots", async () => {
    const [user, other, skill] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture({ name: "Percentages" }),
    ]);

    mockSession(user.id);

    const [older, newer] = await Promise.all([
      mistakeFixture({
        cause: "trap",
        createdAt: new Date("2026-09-01"),
        skillId: skill.id,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: new Date("2026-09-05"),
        snapshot: { answer: "20", question: "Half of 10?" },
        userId: user.id,
      }),
      mistakeFixture({ userId: other.id }),
    ]);

    const result = await listCurrentUserMistakes(query());

    expect(result.status === "ready" && result.mistakes.map((mistake) => mistake.id)).toStrictEqual(
      [newer.id, older.id],
    );

    expect(result.status === "ready" && result.mistakes[0]?.snapshot).toStrictEqual({
      answer: "20",
      question: "Half of 10?",
    });

    expect(result.status === "ready" && result.mistakes[1]?.skill).toStrictEqual({
      id: skill.id,
      name: "Percentages",
    });
  });

  it("filters by cause and status and counts every chip", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all([
      mistakeFixture({ cause: "trap", userId: user.id }),
      mistakeFixture({ cause: "trap", status: "fixed", userId: user.id }),
      mistakeFixture({ cause: "gap", userId: user.id }),
      mistakeFixture({ userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(query({ cause: "trap", status: "open" }));

    expect(result.status === "ready" && result.mistakes).toHaveLength(1);

    expect(result.status === "ready" && result.counts).toStrictEqual({
      byCause: { gap: 1, guess: 0, misread: 0, time: 0, trap: 2, unsorted: 1 },
      fixed: 1,
      open: 3,
    });
  });

  it("scopes the notebook to one goal's skills", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const elsewhere = await skillFixture();
    mockSession(user.id);

    const [inGoal] = await Promise.all([
      mistakeFixture({ skillId: skills[0]?.id, userId: user.id }),
      mistakeFixture({ skillId: elsewhere.id, userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(query({ goalId: goal.id }));

    expect(result.status === "ready" && result.mistakes.map((mistake) => mistake.id)).toStrictEqual(
      [inGoal.id],
    );
  });

  it("pages through the notebook", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        mistakeFixture({ createdAt: new Date(Date.UTC(2026, 8, index + 1)), userId: user.id }),
      ),
    );

    const first = await listCurrentUserMistakes(query({ limit: 2 }));
    const second = await listCurrentUserMistakes(query({ limit: 2, offset: 2 }));

    expect(first.status === "ready" && [first.mistakes.length, first.hasMore]).toStrictEqual([
      2,
      true,
    ]);

    expect(second.status === "ready" && [second.mistakes.length, second.hasMore]).toStrictEqual([
      1,
      false,
    ]);
  });
});
