import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { ANSWERED } from "./onboarding-fixtures";

const SHORT_ID_LENGTH = 6;
const QUESTIONS_PER_SKILL = 4;
const SKILLS_PER_AREA = 2;
const AREAS = ["Mathematics", "Languages"] as const;
const CITATION = { passage: "From the notice.", sourceId: "notice" };

/** One exam day of two sections of eight questions, each one of the notice's subjects. */
const STRUCTURE = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "raw" },
    sections: AREAS.map((name) => ({ day: null, minutes: 12, name, questions: 8 })),
    timeLimitMinutes: 24,
    totalQuestions: 16,
  },
  rules: [],
  subjects: AREAS.map((name) => ({
    citation: CITATION,
    name,
    questions: 8,
    topics: [],
    weight: null,
  })),
};

type Question = { area: string; right: string; skill: string; wrong: string };

/**
 * An exam learner whose plan has two areas (Mathematics, Languages) of two topics each, one lesson
 * per topic, and four questions per topic in the exam's own bank: enough for a mock of either
 * subject or of the whole day without writing any. `onboarding`: the goal waits at placement, with
 * every earlier question answered. `material: false`: a class test with no material yet, so no
 * exam to copy and no questions in the bank. Returns each question's right and wrong answer by
 * its text.
 */
export async function createAnytimeMockLearner({
  material = true,
  onboarding = false,
  plus,
}: {
  material?: boolean;
  onboarding?: boolean;
  plus: boolean;
}) {
  const id = randomUUID().slice(0, SHORT_ID_LENGTH);

  const [user, blueprint, skills] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({ language: "en", name: `Mock Exam ${id}`, structure: STRUCTURE }),
    Promise.all(
      AREAS.flatMap((area) =>
        Array.from({ length: SKILLS_PER_AREA }, (_, index) =>
          skillFixture({ name: `${area} topic ${index + 1} ${id}` }),
        ),
      ),
    ),
  ]);

  const areaOf = (index: number) => AREAS[Math.floor(index / SKILLS_PER_AREA)] ?? "";

  const goal = await goalFixture({
    details: onboarding ? { answered: [...ANSWERED, "target"], level: "basic" } : {},
    examBlueprintId: material ? blueprint.id : null,
    kind: "exam",
    timezone: "UTC",
    title: `Mock Exam ${id}`,
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map((skill, index) => ({
        area: areaOf(index),
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const questions = skills.flatMap((skill, index) =>
    Array.from({ length: QUESTIONS_PER_SKILL }, (_, copy) => ({
      content: choiceItemContent(`${skill.name}, question ${copy + 1}?`),
      skill,
      skillIndex: index,
    })),
  );

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    ...(material ? questions : []).map((question) =>
      itemFixture({
        content: question.content,
        examBlueprintId: blueprint.id,
        skillId: question.skill.id,
      }),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  const answers = new Map<string, Question>(
    questions.map((question) => [
      question.content.question,
      {
        area: areaOf(question.skillIndex),
        right: question.content.options.find((option) => option.isCorrect)?.text ?? "",
        skill: question.skill.name,
        wrong: question.content.options.find((option) => !option.isCorrect)?.text ?? "",
      },
    ]),
  );

  return { answers, goal, plan, skills, user };
}

/**
 * Answers the running section's questions in order: right on the topics `knows` names, wrong on
 * the rest, until `count` are answered (all of them without it). It moves with Next.
 */
export async function answerMockQuestions({
  answers,
  count,
  knows,
  page,
}: {
  answers: Map<string, Question>;
  count?: number;
  knows: (question: Question) => boolean;
  page: Page;
}) {
  const counter = await page.getByText(/^Question 1 of \d+/u).textContent();
  const total = Number(/of (?<total>\d+)/u.exec(counter ?? "")?.groups?.total ?? 0);
  const last = count ?? total;

  for (let number = 1; number <= last; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A mock is answered one question at a time.
    await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

    // oxlint-disable-next-line no-await-in-loop -- The question on screen decides the answer.
    const heading = (await page.getByRole("heading", { level: 2 }).textContent()) ?? "";
    const question = answers.get(heading.trim());

    // oxlint-disable-next-line no-await-in-loop -- One answer, then the next question.
    await page
      .getByRole("radio", { name: question && knows(question) ? question.right : question?.wrong })
      .click();

    if (number < total) {
      // oxlint-disable-next-line no-await-in-loop -- Next shows the following question.
      await page.getByRole("button", { name: "Next" }).click();
    }
  }
}
