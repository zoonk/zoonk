import { randomUUID } from "node:crypto";
import { type Page, type Route, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { AREAS, WRITTEN_ESSAY, getStructure } from "./anytime-mock-exams";
import { ANSWERED } from "./onboarding-fixtures";

const SHORT_ID_LENGTH = 6;
const LOWERCASE_A_CODE_POINT = 97;
const QUESTIONS_PER_SKILL = 4;
const SKILLS_PER_AREA = 2;

type Question = { area: string; right: string; skill: string; wrong: string };

/** The area of the plan's skill at this index: two per area, in order. */
function areaOf(index: number): string {
  return AREAS[Math.floor(index / SKILLS_PER_AREA)] ?? "";
}

/**
 * An exam learner whose plan has two areas (Mathematics, Languages) of two topics each, one lesson
 * per topic, and four questions per topic in the exam's own bank: enough for a mock of either
 * subject or of the whole day without writing any. `onboarding`: the goal waits at placement, with
 * every earlier question answered. Returns each question's right and wrong answer by its text.
 */
export async function createAnytimeMockLearner({
  onboarding = false,
  plus,
  written = false,
}: {
  onboarding?: boolean;
  plus: boolean;
  /** The exam day ends with a discursive test, which its full mock asks (`WRITTEN_STRUCTURE`). */
  written?: boolean;
}) {
  // Numeric-only random suffixes are grouped by Markdown, which changes the fixture lookup key.
  const id = randomUUID()
    .slice(0, SHORT_ID_LENGTH)
    .replaceAll(/[0-9a-f]/gu, (digit) =>
      String.fromCodePoint(LOWERCASE_A_CODE_POINT + Number.parseInt(digit, 16)),
    );

  const [user, blueprint, skills] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({
      language: "en",
      name: `Mock Exam ${id}`,
      structure: getStructure({ written }),
    }),
    Promise.all(
      AREAS.flatMap((area) =>
        Array.from({ length: SKILLS_PER_AREA }, (_, index) =>
          skillFixture({ name: `${area} topic ${index + 1} ${id}` }),
        ),
      ),
    ),
  ]);

  const goal = await goalFixture({
    details: onboarding ? { answered: [...ANSWERED, "target"], level: "basic" } : {},
    examBlueprintId: blueprint.id,
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
    ...questions.map((question) =>
      itemFixture({
        content: question.content,
        examBlueprintId: blueprint.id,
        skillId: question.skill.id,
      }),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    written
      ? itemFixture({
          content: WRITTEN_ESSAY,
          examBlueprintId: blueprint.id,
          format: "essay",
          skillId: skills[0]?.id ?? "",
        })
      : null,
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
 * Answers the running section's questions in order, from the one on screen: right on the topics
 * `knows` names, wrong on the rest, until `count` are answered (the whole section without it). It
 * moves with Next, which the section's last question doesn't have.
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
  const main = page.getByRole("main");
  const counter = await page.getByText(/^Question \d+ of \d+/u).textContent();
  const groups = /^Question (?<first>\d+) of (?<total>\d+)/u.exec(counter ?? "")?.groups;
  const first = Number(groups?.first ?? 1);
  const total = Number(groups?.total ?? 0);
  const last = count === undefined ? total : first + count - 1;

  for (let number = first; number <= last; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A mock is answered one question at a time.
    await expect(page.getByText(new RegExp(`^Question ${number} of \\d+`, "u"))).toBeVisible();

    const title = main.getByRole("heading", { level: 2 });
    // Wait for the question title before selecting its fixture answer.
    // oxlint-disable-next-line no-await-in-loop -- Each question must be ready before answering it.
    await expect(title).not.toBeEmpty();
    // oxlint-disable-next-line no-await-in-loop -- The question on screen decides the answer.
    const heading = (await title.textContent()) ?? "";
    const question = answers.get(heading.trim());
    expect(question, `No fixture answer for the visible question: ${heading}`).toBeDefined();

    // oxlint-disable-next-line no-await-in-loop -- One answer, then the next question.
    await page
      .getByRole("radio", { name: question && knows(question) ? question.right : question?.wrong })
      .click();

    const next = page.getByRole("button", { name: "Next" });

    // oxlint-disable-next-line no-await-in-loop -- The section's last question has no Next.
    if (number === total || !(await next.isVisible())) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- Next shows the following question.
    await next.click();
  }
}

/** A mock page's Server Action with two arguments, the mock and the time zone: grading or finish. */
const TWO_ARGUMENT_ACTION = /^\["[\w-]+","[^"\]]+"\]$/u;

/** Aborts a mock's essay grading, and lets every other request through. */
function abortEssayGrading(route: Route) {
  const request = route.request();

  const isGrading =
    request.method() === "POST" &&
    Boolean(request.headers()["next-action"]) &&
    TWO_ARGUMENT_ACTION.test(request.postData() ?? "");

  return isGrading ? route.abort() : route.fallback();
}

/**
 * Stands in for an outage of the essays' grading before the server sees it: E2E has no model, and
 * a server that tried would report the failure. Only for a mock handed in section by section (its
 * hand-in has three arguments), since finish has grading's shape. Returns what lifts it.
 */
export async function failEssayGrading(page: Page) {
  await page.route("**/*", abortEssayGrading);
  return () => page.unroute("**/*", abortEssayGrading);
}
