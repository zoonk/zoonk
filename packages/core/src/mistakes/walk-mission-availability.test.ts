import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { listeningGoalFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { loadDayMissionFacts } from "../sessions/missions/day-facts";
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

  it("doesn't offer an older mistake through today's mistake's passage question on its skill", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const skillId = skills[0]!.id;
    const set = await itemSetFixture();
    const passageQuestion = await itemFixture({ setId: set.id, setPosition: 0, skillId });

    await Promise.all([
      mistakeFixture({ createdAt: new Date("2026-10-12"), skillId, userId: user.id }),
      mistakeFixture({
        createdAt: new Date("2026-10-13T11:00:00Z"),
        itemId: passageQuestion.id,
        skillId,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const [notebook, missions, practice] = await Promise.all([
      listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId: goal.id })),
      loadDayMissionFacts({
        blocks: [],
        goal,
        localDate: new Date("2026-10-13"),
        plannedMinutes: 20,
        timeZone: "UTC",
        userId: user.id,
      }),
      getMistakePractice({ goalId: goal.id }),
    ]);

    expect(notebook).toMatchObject({ availability: { ready: 0, tomorrow: 1 } });
    expect(missions.readyMistakeCount).toBe(0);
    expect(practice).toMatchObject({ practice: [], status: "ready" });
  });

  it("doesn't offer a finer skill's mistake through another mistake's passage question on its goal skill", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const user = await userFixture();

    const { goal, planItems, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const goalSkillId = skills[0]!.id;
    const [finer, set] = await Promise.all([skillFixture(), itemSetFixture()]);

    const [passageQuestion] = await Promise.all([
      itemFixture({ setId: set.id, setPosition: 0, skillId: goalSkillId }),
      lessonSkillFixture({ lessonId: planItems[0]!.lessonId!, skillId: finer.id }),
    ]);

    await Promise.all([
      mistakeFixture({ createdAt: new Date("2026-10-12"), skillId: finer.id, userId: user.id }),
      mistakeFixture({
        createdAt: new Date("2026-10-12"),
        itemId: passageQuestion.id,
        skillId: goalSkillId,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const scope = { goalId: goal.id, skillId: finer.id };

    const [notebook, practice] = await Promise.all([
      listCurrentUserMistakes(mistakeListInputSchema.parse(scope)),
      getMistakePractice(scope),
    ]);

    expect(notebook).toMatchObject({
      availability: { ready: 0, tomorrow: 0 },
      mistakes: [{ practiceAvailable: false }],
    });

    expect(practice).toMatchObject({ practice: [], status: "ready" });
  });
});
