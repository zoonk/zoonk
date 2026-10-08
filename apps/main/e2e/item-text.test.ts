import { randomUUID } from "node:crypto";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { expect, test } from "./fixtures";
import { ANSWERED } from "./onboarding-fixtures";

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
