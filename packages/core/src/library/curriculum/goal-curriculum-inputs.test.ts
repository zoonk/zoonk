import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getReferenceSyllabusNeed, loadGoalCurriculumInputs } from "./goal-curriculum-inputs";

const citation = { passage: "passage", sourceId: "source" };

const structure = {
  formats: [],
  mock: null,
  rules: [],
  subjects: [
    {
      citation,
      name: "Mathematics",
      questions: 45,
      topics: ["Percentages", "Functions"],
      weight: 0.25,
    },
    { citation, name: "Languages", questions: 45, topics: ["Reading"], weight: null },
  ],
};

describe(loadGoalCurriculumInputs, () => {
  it("reads what the skill graph needs from an exam goal: its blueprint, its sources and whether a plan exists", async () => {
    const user = await userFixture();

    const [blueprint, source] = await Promise.all([
      examBlueprintFixture({
        name: "ENEM",
        structure,
        topicFrequency: [
          {
            basis: "2019-2024 papers",
            citation,
            level: "high",
            subject: "Mathematics",
            topic: "Percentages",
          },
        ],
      }),
      sourceFixture({ extractedText: "Syllabus text", title: "Official syllabus" }),
    ]);

    const goal = await goalFixture({
      details: { level: "basic", purpose: "deep", targetScore: 800 },
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learnerSourceFixture({ goalId: goal.id, sourceId: source.id, userId: user.id }),
    ]);

    const inputs = await loadGoalCurriculumInputs(goal.id);

    expect(inputs).toMatchObject({
      goal: { examBlueprintId: blueprint.id, id: goal.id, kind: "exam", userId: user.id },
      graphPrompt: {
        context: '{"targetScore":800}',
        goalKind: "exam",
        ownLevel: "basic",
        purpose: "deep",
      },
      hasPlanGraph: false,
      isGuest: false,
      references: [{ text: "Syllabus text", title: "Official syllabus" }],
      // Answered on paper: its courses teach its skills in chapters without tools.
      usesTools: false,
    });

    // Each subject with its group, weight and every topic, and how often the board asks each topic.
    expect(inputs?.graphPrompt.examBlueprint).toStrictEqual({
      name: "ENEM",
      notes: [],
      subjects: [
        {
          group: null,
          name: "Mathematics",
          questions: 45,
          topics: ["Percentages", "Functions"],
          weight: 0.25,
        },
        { group: null, name: "Languages", questions: 45, topics: ["Reading"], weight: null },
      ],
      topicFrequency: [{ level: "high", subject: "Mathematics", topic: "Percentages" }],
    });

    // The coverage check reads it as the skill graph does, under the exam's name.
    expect(inputs?.blueprintReference).toStrictEqual({
      text: [
        "EXAM: ENEM",
        "SUBJECTS:\nS1. Mathematics (45 questions; weight 25%)\n  S1.1 Percentages\n  S1.2 Functions\nS2. Languages (45 questions)\n  S2.1 Reading",
        "TOPIC_FREQUENCY:\n- Mathematics / Percentages: high",
      ].join("\n\n"),
      title: "ENEM",
    });
  });

  it("knows a guest and a plan already built, and skips explain questions", async () => {
    const guest = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

    const [goal, question] = await Promise.all([
      goalFixture({ userId: guest.id }),
      goalFixture({ kind: "explain", userId: guest.id }),
    ]);

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Phase" }],
        skills: [
          { area: null, lessons: 1, name: "Skill", phase: 0, skillId: "skill", weight: null },
        ],
      },
    });

    await expect(loadGoalCurriculumInputs(goal.id)).resolves.toMatchObject({
      hasPlanGraph: true,
      isGuest: true,
      usesTools: true,
    });

    await expect(loadGoalCurriculumInputs(question.id)).resolves.toBeNull();
  });

  it("waits for the onboarding answers that shape the graph, only for goals typed in onboarding", async () => {
    const user = await userFixture();
    const onboardingId = crypto.randomUUID();

    const [asking, answered, skippedRole, notOnboarding] = await Promise.all([
      goalFixture({ details: { onboardingId, subject: "Statistics" }, userId: user.id }),
      goalFixture({
        details: {
          answered: ["purpose", "level"],
          level: "none",
          onboardingId,
          purpose: "overview",
        },
        userId: user.id,
      }),
      goalFixture({
        details: { answered: ["role"], level: "basic", onboardingId, purpose: "work" },
        userId: user.id,
      }),
      goalFixture({ details: { subject: "Statistics" }, userId: user.id }),
    ]);

    const inputs = await Promise.all(
      [asking, answered, skippedRole, notOnboarding].map((goal) =>
        loadGoalCurriculumInputs(goal.id),
      ),
    );

    expect(inputs.map((item) => item?.awaitingAnswers)).toStrictEqual([true, false, false, false]);

    // Onboarding's bookkeeping stays out of what the model reads; the level is its own line.
    expect(inputs[1]?.graphPrompt).toMatchObject({ context: undefined, ownLevel: "none" });
  });

  it("asks a career change for the role they're aiming for", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: {
        level: "none",
        onboardingId: crypto.randomUUID(),
        purpose: "careerChange",
        role: "Teacher",
      },
      userId: user.id,
    });

    await expect(loadGoalCurriculumInputs(goal.id)).resolves.toMatchObject({
      awaitingAnswers: true,
      graphPrompt: { context: '{"role":"Teacher"}', purpose: "careerChange" },
    });
  });
});

describe(getReferenceSyllabusNeed, () => {
  const learn = { kind: "learn" as const, targetDate: null };

  it("checks a learn goal against reference syllabi when the learner goes deep or changes careers", () => {
    expect(getReferenceSyllabusNeed({ ...learn, details: { purpose: "deep" } })).toBe("needed");

    expect(getReferenceSyllabusNeed({ ...learn, details: { purpose: "careerChange" } })).toBe(
      "needed",
    );

    expect(getReferenceSyllabusNeed({ ...learn, details: { purpose: "overview" } })).toBe(
      "notNeeded",
    );

    expect(getReferenceSyllabusNeed({ ...learn, details: { purpose: "work" } })).toBe("notNeeded");
  });

  it("waits while onboarding may still ask the purpose, and never for other goals", () => {
    const onboardingId = crypto.randomUUID();

    expect(getReferenceSyllabusNeed({ ...learn, details: { onboardingId } })).toBe(
      "awaitingPurpose",
    );

    expect(
      getReferenceSyllabusNeed({ ...learn, details: { answered: ["purpose"], onboardingId } }),
    ).toBe("notNeeded");

    // Plan links and API clients never answer onboarding, so nothing is waited for.
    expect(getReferenceSyllabusNeed({ ...learn, details: {} })).toBe("notNeeded");

    expect(
      getReferenceSyllabusNeed({ details: { purpose: "deep" }, kind: "exam", targetDate: null }),
    ).toBe("notNeeded");
  });
});
