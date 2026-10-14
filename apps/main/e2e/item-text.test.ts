import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { ANSWERED } from "./onboarding-fixtures";
import { openAs, pickAndCheck } from "./study-day";

/**
 * A data question stored the way item writers wrote them in Sep 2026: its data as a GFM pipe table
 * in the support text, and each option with the letter the exam's style named ("A a E").
 */
const TABLE_QUESTION = {
  context: [
    "A city counted daily trips, in thousands, by mode of transport.",
    "",
    "| Mode | 2022 | 2023 |",
    "|---|---:|---:|",
    "| Bus | 240 | 250 |",
    "| Subway | 180 | 210 |",
  ].join("\n"),
  options: [
    {
      isCorrect: false,
      misconception: "Compares totals instead of changes",
      reason: "The bus has more trips, but it grew by 10 thousand.",
      text: "B) The bus",
    },
    {
      isCorrect: true,
      misconception: null,
      reason: "It grew by 30 thousand.",
      text: "A) The subway",
    },
  ],
  question: "Which mode of transport grew the most from 2022 to 2023?",
};

/** A small drawing the browser loads without a network, standing in for a stored picture. */
const FIGURE_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><circle cx="30" cy="20" r="15" fill="#7FC8A0"/></svg>',
)}`;

/** A question about a figure, as stored once its picture passed the image check. */
const FIGURE_QUESTION = {
  context: "Na figura, a seta aponta para uma organela da célula vegetal.",
  image: {
    alt: "Uma célula vegetal com uma seta apontando para o cloroplasto.",
    prompt: "Célula vegetal com uma seta no cloroplasto.",
  },
  options: [
    {
      isCorrect: true,
      misconception: null,
      reason: "É verde e faz fotossíntese.",
      text: "O cloroplasto",
    },
    {
      isCorrect: false,
      misconception: "Confunde as organelas",
      reason: "O núcleo guarda o DNA.",
      text: "O núcleo",
    },
  ],
  question: "Qual organela a seta indica?",
};

/** Item writers quote a word or a sentence in _italics_, in options and reasons too. */
const QUOTED_WORDS_QUESTION = {
  context: "Valéria quotes a resident in an exhibition: _A gente se reunia na calçada._",
  options: [
    {
      isCorrect: true,
      misconception: null,
      reason: "The quote keeps the resident's own words.",
      text: "Keep the quote as the resident said it",
    },
    {
      isCorrect: false,
      misconception: "Treats a quote as text to correct",
      reason: "A quote keeps what was said.",
      text: "Change _a gente se reunia_ to _nós nos reuníamos_",
    },
  ],
  question: "Which decision fits the exhibition?",
};

async function createGoalWithQuestion({
  content,
  mediaAssetId = null,
  userId,
}: {
  content: object;
  mediaAssetId?: string | null;
  userId: string;
}) {
  const [goal, skill] = await Promise.all([
    goalFixture({
      details: { answered: ANSWERED, subject: "reading data" },
      prompt: `read data tables ${randomUUID()}`,
      title: "Read data tables",
      userId,
    }),
    skillFixture({ name: `Reading tables ${randomUUID()}` }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Stage 1" }],
      skills: [
        { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
  });

  await Promise.all([
    planItemFixture({
      kind: "lesson",
      phase: 0,
      planId: plan.id,
      position: 0,
      skillId: skill.id,
      titleSnapshot: "Lesson 1",
    }),
    itemFixture({ content, mediaAssetId, skillId: skill.id }),
  ]);

  return goal;
}

test("a placement question shows its data as a table and its options without printed letters", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createGoalWithQuestion({ content: TABLE_QUESTION, userId: noProgressUser.id });
  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  const table = page.getByRole("region", { name: "Mode, 2022, 2023" }).getByRole("table");

  await expect(table.getByRole("columnheader")).toHaveText(["Mode", "2022", "2023"]);
  await expect(table.getByRole("row")).toHaveCount(3);

  await expect(table.getByRole("row").nth(2).getByRole("cell")).toHaveText([
    "Subway",
    "180",
    "210",
  ]);

  await expect(page.getByText("|---|", { exact: false })).toHaveCount(0);

  await expect(page.getByText("The subway", { exact: true })).toBeVisible();
  await expect(page.getByText("The bus", { exact: true })).toBeVisible();
  await expect(page.getByText(/^[AB]\) The/u)).toHaveCount(0);
});

test("a placement question about a figure shows its picture with the question", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const picture = await mediaAssetFixture({ height: 40, url: FIGURE_URL, width: 60 });

  const goal = await createGoalWithQuestion({
    content: FIGURE_QUESTION,
    mediaAssetId: picture.id,
    userId: noProgressUser.id,
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  await expect(page.getByText("Qual organela a seta indica?")).toBeVisible();
  await expect(page.getByRole("img", { name: FIGURE_QUESTION.image.alt })).toBeVisible();
});

test("a placement question's options show quoted words in italics, never underscores", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createGoalWithQuestion({
    content: QUOTED_WORDS_QUESTION,
    userId: noProgressUser.id,
  });

  await page.goto(`/start/${goal.id}`);
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  const options = page.getByRole("radiogroup", { name: QUOTED_WORDS_QUESTION.question });
  await expect(options.getByRole("radio", { name: /nós nos reuníamos/u })).toBeVisible();
  await expect(options.locator("em", { hasText: "nós nos reuníamos" })).toBeVisible();
  await expect(page.getByText("_", { exact: false })).toHaveCount(0);
});

test("practice feedback shows quoted words in italics, never underscores", async ({ browser }) => {
  const [user, skill] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Official writing ${randomUUID()}` }),
  ]);

  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });

  const [plan, lesson] = await Promise.all([
    planFixture({ goalId: goal.id }),
    libraryLessonFixture({ title: "Official writing" }),
  ]);

  const [item, session] = await Promise.all([
    itemFixture({
      content: {
        context: null,
        isTrue: true,
        misconception: null,
        reason: "_Em breve_ names no deadline, so the reader can't tell when.",
        statement: `"Em breve" makes a notice imprecise: ${randomUUID()}`,
      },
      format: "trueFalse",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 2,
    kind: "review",
    payload: {
      capsules: [
        {
          format: "swipe",
          itemIds: [item.id],
          key: `skill:${skill.id}`,
          lessonId: null,
          skillIds: [skill.id],
          title: "Official writing",
        },
      ],
      skillIds: [skill.id],
    },
    position: 0,
    sessionId: session.id,
  });

  const page = await openAs(browser, user);
  await page.goto("/session");
  await page.getByRole("button", { name: /^Start/u }).click();
  await pickAndCheck(page, /^True/u);

  const feedback = page.getByRole("region", { name: "Answer feedback" });
  await expect(feedback.locator("em", { hasText: "Em breve" })).toBeVisible();
  await expect(feedback.getByText("_", { exact: false })).toHaveCount(0);
  await page.context().close();
});
