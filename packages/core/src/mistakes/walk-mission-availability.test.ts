import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { listeningGoalFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { getStudySession } from "../sessions/get-study-session";
import { mistakeListInputSchema } from "./contract";
import { getMistakePractice } from "./get-mistake-practice";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

describe("mistake mission and notebook availability", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps an older mistake visible without offering practice when its skill has no questions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    mockSession(user.id);

    await mistakeFixture({
      createdAt: new Date("2026-10-12"),
      skillId: skills[0]?.id,
      userId: user.id,
    });

    const result = await listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId: goal.id }));

    expect(result).toMatchObject({
      availability: { ready: 0, tomorrow: 0 },
      counts: { open: 1 },
      mistakes: [{ practiceAvailable: false, practiceAvailableTomorrow: false }],
    });

    await expect(getMistakePractice({ goalId: goal.id })).resolves.toMatchObject({
      practice: [],
      status: "ready",
    });
  });

  it("offers only a recording mistake on a skill practiced with listening", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const { blueprint, goal, listeningSkills, plan, user } = await listeningGoalFixture();
    mockSession(user.id);
    const skillId = listeningSkills[0]!.id;
    await planItemFixture({ planId: plan.id, skillId });
    const set = await listeningSetFixture({ examBlueprintId: blueprint.id });

    const [text, recorded] = await Promise.all([
      itemFixture({ content: choiceItemContent(), skillId }),
      itemFixture({
        content: choiceItemContent(),
        examBlueprintId: blueprint.id,
        setId: set.id,
        setPosition: 0,
        skillId,
      }),
    ]);

    const [textMistake, recordedMistake] = await Promise.all([
      mistakeFixture({
        createdAt: new Date("2026-10-12"),
        itemId: text.id,
        skillId,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: new Date("2026-10-12"),
        itemId: recorded.id,
        skillId,
        userId: user.id,
      }),
    ]);

    const notebook = await listCurrentUserMistakes(
      mistakeListInputSchema.parse({ goalId: goal.id }),
    );

    const practice = await getMistakePractice({ goalId: goal.id });

    expect(notebook).toMatchObject({
      availability: { ready: 1, tomorrow: 0 },
      counts: { open: 2 },
    });

    expect(
      notebook.status === "ready" && notebook.mistakes.find((entry) => entry.id === textMistake.id),
    ).toMatchObject({ practiceAvailable: false, practiceAvailableTomorrow: false });

    expect(
      practice.status === "ready" && practice.practice.map((entry) => entry.mistakeId),
    ).toStrictEqual([recordedMistake.id]);
  });

  it("separates mistakes ready now from today's mistakes using the goal's local midnight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T02:30:00Z"));
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const { goal, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    await prisma.goal.update({ data: { timezone: "America/Sao_Paulo" }, where: { id: goal.id } });
    mockSession(user.id);

    const [ready, tomorrow] = await Promise.all([
      mistakeFixture({
        createdAt: new Date("2026-10-12T02:59:59Z"),
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: new Date("2026-10-12T03:00:00Z"),
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      mistakeFixture({ skillId: skills[0]?.id, userId: other.id }),
      mistakeFixture({ skillId: skills[0]?.id, status: "fixed", userId: user.id }),
      mistakeFixture({ createdAt: new Date("2026-10-11"), userId: user.id }),
    ]);

    const result = await listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId: goal.id }));

    expect(result).toMatchObject({ availability: { ready: 1, tomorrow: 1 }, status: "ready" });

    expect(
      result.status === "ready" && result.mistakes.find((entry) => entry.id === ready.id),
    ).toMatchObject({ practiceAvailable: true });

    expect(
      result.status === "ready" && result.mistakes.find((entry) => entry.id === tomorrow.id),
    ).toMatchObject({ practiceAvailable: false });

    vi.setSystemTime(new Date("2026-10-13T03:00:00Z"));

    await expect(
      listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId: goal.id })),
    ).resolves.toMatchObject({ availability: { ready: 2, tomorrow: 0 } });
  });

  it("offers the fix mission for notebook mistakes even without a scheduled drill", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const user = await userFixture();
    const { goal, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });
    mockSession(user.id);
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    await mistakeFixture({
      createdAt: new Date("2026-10-12T12:00:00Z"),
      skillId: skills[0]?.id,
      userId: user.id,
    });

    const result = await getStudySession({ input: {}, sessionId: session.id });

    expect(
      result.status === "ready" &&
        result.session.missions.find((mission) => mission.kind === "fixMistake"),
    ).toStrictEqual({
      done: 0,
      kind: "fixMistake",
      minutes: 2,
      opens: { kind: "mistakesPractice" },
      status: "todo",
      total: 1,
    });
  });
});
