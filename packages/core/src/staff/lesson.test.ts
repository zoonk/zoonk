import { STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import { signInProposer } from "./content-fixes/_test-utils/content-fix-steps";
import { getStaffLesson } from "./lesson";

describe("staff lesson", () => {
  it("reads the plan, current screens, idea marks and language rows together", async () => {
    const [{ lesson, sentence, steps, word }] = await Promise.all([
      languageLessonFixture({ sentenceAudioUrl: "https://example.test/rent.mp3" }),
      signInProposer([STAFF_READ_SCOPE]),
    ]);

    const [first] = steps;

    if (!first) {
      throw new Error("Expected a vocabulary screen");
    }

    const ideas = [{ label: "Rent", text: "Learn how to ask about the rent." }];

    const plan = {
      canDo: "Ask how much the rent is.",
      description: lesson.description,
      estimatedMinutes: 5,
      screens: [
        {
          activityTemplate: null,
          brief: "Explain rent.",
          kind: "explanation",
          skills: [0],
          visual: null,
          visualKind: "none",
        },
      ],
      skills: [
        {
          description: "Ask about rent.",
          example: sentence.sentence,
          hard: false,
          name: "Rent",
          topic: "Housing",
          useCase: "Looking for an apartment.",
        },
      ],
      title: lesson.title,
    };

    await Promise.all([
      prisma.lesson.update({
        data: {
          spec: { ...plan, plannedAt: "2026-11-20" },
          stagedSummary: { ideas: [{ label: "Staged", text: "A different plan." }] },
          summary: { ideas },
        },
        where: { id: lesson.id },
      }),
      prisma.step.updateMany({
        data: { version: 2 },
        where: { id: { in: steps.map(({ id }) => id) } },
      }),
      libraryStepFixture({ lessonId: lesson.id, position: 0, staged: true, version: 3 }),
    ]);

    const [variant] = await Promise.all([
      stepVariantFixture({ content: { text: "Rent for a storefront." }, stepId: first.id }),
      libraryStepFixture({ lessonId: lesson.id, position: 0, retiredAt: new Date(), version: 1 }),
      prisma.step.update({
        data: {
          marks: { example: null, iconId: null, iconPending: false, ideaIndex: 0, underline: null },
        },
        where: { id: first.id },
      }),
    ]);

    const result = await getStaffLesson({ lessonId: lesson.id });

    expect(result).toMatchObject({
      id: lesson.id,
      ideas,
      plan,
      sentences: [
        {
          audioAvailable: true,
          distractors: ["are", "many"],
          id: sentence.id,
          sentence: sentence.sentence,
          translation: "Quanto é o aluguel?",
          translationDistractors: ["renda", "custa"],
        },
      ],
      status: "ready",
      version: 2,
      words: [
        {
          audioAvailable: false,
          distractors: ["deposit", "bill"],
          id: word.id,
          translation: "aluguel",
          word: word.word,
        },
      ],
    });

    if (result.status !== "ready") {
      throw new Error("Expected the staff lesson");
    }

    expect(result.plan).toStrictEqual(plan);
    expect(result.screens.map(({ id }) => id)).toStrictEqual(steps.map(({ id }) => id));

    expect(result.screens[0]).toMatchObject({
      citation: null,
      content: {},
      ideaIndex: 0,
      kind: "vocabulary",
      word: word.word,
      wordId: word.id,
    });

    expect(result.screens[0]?.variants).toStrictEqual([
      { content: variant.content, id: variant.id, key: variant.key, kind: variant.kind },
    ]);

    expect(result.screens[2]).toMatchObject({
      ideaIndex: null,
      kind: "reading",
      sentence: sentence.sentence,
      sentenceId: sentence.id,
      variants: [],
    });
  });
});
