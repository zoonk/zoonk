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
import { toScopedGraphPrompt } from "./shared-graph-prompt";

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
          choiceGroup: null,
          group: null,
          name: "Mathematics",
          questions: 45,
          shortName: null,
          topics: ["Percentages", "Functions"],
          weight: 0.25,
        },
        {
          choiceGroup: null,
          group: null,
          name: "Languages",
          questions: 45,
          shortName: null,
          topics: ["Reading"],
          weight: null,
        },
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
      sharedContext: undefined,
    });
  });

  // A learner's role ("teacher") once named a shared skill "Relate teaching experience to UX
  // work", which other learners' plans could reuse.
  it("gives a shared curriculum the goal's general form and fixed choices, never the learner's words", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: {
        followUps: [{ answer: "Na escola Santa Rita, em Pelotas", question: "Onde?" }],
        level: "none",
        purpose: "careerChange",
        reason: "Cansei de dar aula para a Maria",
        role: "Professora",
        targetPosition: "UX designer",
      },
      prompt: "Sou a Joana, professora em Pelotas, e quero virar UX designer",
      title: "Tornar-se UX designer",
      userId: user.id,
    });

    const inputs = await loadGoalCurriculumInputs(goal.id);

    if (!inputs) {
      throw new Error("Expected the goal's inputs");
    }

    const shared = toScopedGraphPrompt({ inputs, scope: { generalGoal: null, ownerId: null } });

    const general = toScopedGraphPrompt({
      inputs,
      scope: { generalGoal: "Trabalhar como UX designer", ownerId: null },
    });

    const owned = toScopedGraphPrompt({ inputs, scope: { generalGoal: null, ownerId: user.id } });

    expect(shared).toMatchObject({
      context: '{"targetPosition":"UX designer"}',
      goal: "Tornar-se UX designer",
      purpose: "careerChange",
    });

    expect(general.goal).toBe("Trabalhar como UX designer");
    expect(JSON.stringify(shared)).not.toMatch(/Joana|Pelotas|Professora|Maria|Santa Rita/u);

    // The learner's own private course still reads everything they told onboarding.
    expect(owned.goal).toBe(goal.prompt);
    expect(owned.context).toMatch(/Professora/u);

    // A learn goal's graph starts where the learner is.
    expect(shared.ownLevel).toBe("none");
  });

  // The first learner's "750 points for medicine" once reached the shared ENEM graph every later
  // learner plans from, through the goal's general form and its details.
  it("writes an exam's shared graph from the exam alone, never its first learner's words, target or level", async () => {
    const [user, blueprint] = await Promise.all([
      userFixture(),
      examBlueprintFixture({ name: "ENEM", role: null }),
    ]);

    const details = {
      examName: "ENEM",
      examTarget: "admission",
      examYear: 2027,
      institution: "UFMG",
      knownSubjects: ["Ciências Humanas"],
      level: "advanced",
      reason: "Meu pai é médico em Pelotas",
      targetCourse: "Medicina",
      targetScore: "750",
    };

    const [linked, understood] = await Promise.all([
      goalFixture({
        details,
        examBlueprintId: blueprint.id,
        kind: "exam",
        prompt: "Sou o Lucas: quero tirar 750 no ENEM pra passar em Medicina na UFMG",
        title: "Passar no ENEM com 750 em Medicina",
        userId: user.id,
      }),
      // Before research reads the notice, the exam is the one onboarding understood.
      goalFixture({
        details,
        kind: "exam",
        prompt: "Sou o Lucas: quero tirar 750 no ENEM pra passar em Medicina na UFMG",
        title: "Passar no ENEM com 750 em Medicina",
        userId: user.id,
      }),
    ]);

    const [linkedInputs, understoodInputs] = await Promise.all([
      loadGoalCurriculumInputs(linked.id),
      loadGoalCurriculumInputs(understood.id),
    ]);

    if (!linkedInputs || !understoodInputs) {
      throw new Error("Expected the goals' inputs");
    }

    // The general form a model wrote from the learner's words is no exam's identity.
    const scope = {
      generalGoal: "Preparação para o ENEM com foco em 750 pontos para Medicina",
      ownerId: null,
    };

    const prompts = [linkedInputs, understoodInputs].map((inputs) =>
      toScopedGraphPrompt({ inputs, scope }),
    );

    for (const prompt of prompts) {
      expect(prompt).toMatchObject({ context: undefined, goal: "ENEM", ownLevel: undefined });
      expect(JSON.stringify(prompt)).not.toMatch(/Lucas|Pelotas|pai|750|Medicina|UFMG|Humanas/u);
    }

    expect(linkedInputs.examIdentity).toBe("ENEM");

    // A private course is the learner's own and still reads what they told onboarding.
    const owned = toScopedGraphPrompt({
      inputs: linkedInputs,
      scope: { generalGoal: null, ownerId: user.id },
    });

    expect(owned).toMatchObject({ goal: linked.prompt, ownLevel: "advanced" });
    expect(owned.context).toMatch(/Medicina/u);
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
