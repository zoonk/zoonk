import { type Locator, type TestInfo } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { settleAnimations } from "@zoonk/testing/accessibility/scan";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  listeningBlueprintFixture,
  listeningContent,
  listeningSetFixture,
} from "@zoonk/testing/fixtures/listening";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { toneUrl } from "./listening-audio";
import { captureMissionEnding } from "./mission-ending-captures";
import { LESSON_IDEA, TRAP, createMistakeLearner, drillQuestion } from "./mistake-drill-days";
import { stubScreenTutor } from "./screen-tutor";
import { checkWithEnter, openAs } from "./study-day";

async function captureUnknownFeedback({
  page,
  testInfo,
  width,
  colorScheme,
}: {
  page: Page;
  testInfo: TestInfo;
  width: number;
  colorScheme: "light" | "dark";
}) {
  await page.setViewportSize({ height: 900, width });
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  // A theme's colors fade in; a capture mid-fade isn't the screen people read.
  await expect.poll(() => page.evaluate(settleAnimations, 3000)).toBe(0);

  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: testInfo.outputPath(`unknown-feedback-${width}-${colorScheme}.png`),
  });
}

/** Where a control starts across the bar, to read the order its buttons are in. */
async function leftEdge(control: Locator) {
  const box = await control.boundingBox();
  return box?.x ?? 0;
}

/**
 * Ana's mistakes notebook: its name with how many are left to fix and fixed, "Practice mistakes"
 * beside it, then the skills with their counts beside the selected one's mistakes (an inbox on a
 * laptop), each with why it happened, and the fixed ones on the notebook's other tab.
 */
test.describe("Mistakes notebook", () => {
  for (const width of [390, 1440]) {
    test(`renders a saved Markdown question table at ${width}px after returning to the notebook`, async ({
      browser,
    }, testInfo) => {
      const { drills, user } = await createMistakeLearner({ causes: ["guess"] });

      const question =
        "Use the information to find the price.\n\n| Informação | Valor |\n| --- | ---: |\n| Preço original | R$ 120 |\n| Desconto | 15% |";

      await prisma.mistake.update({
        data: { snapshot: { answer: "R$ 18", correctAnswer: "R$ 102", question } },
        where: { id: drills[0]!.mistake.id },
      });

      const page = await openAs(browser, user);
      await page.setViewportSize({ height: 900, width });
      await page.goto("/mistakes");

      await expect(
        page.getByText("Use the information to find the price.", { exact: false }),
      ).toBeVisible();

      await page.screenshot({ fullPage: true, path: testInfo.outputPath(`notebook-${width}.png`) });
      const table = page.getByRole("table");
      await expect(table).toBeVisible();
      await expect(table.getByRole("columnheader")).toHaveText(["Informação", "Valor"]);

      await expect(table.getByRole("cell")).toHaveText([
        "Preço original",
        "R$120",
        "Desconto",
        "15%",
      ]);

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );

      await page.goto("/today");
      await page.goto("/mistakes");
      await expect(table).toBeVisible();
      await expect(page.getByText("| --- | ---: |", { exact: false })).toHaveCount(0);
      await page.context().close();
    });
  }

  test("scrolling a wide true-or-false stem on a phone keeps the answer unpicked", async ({
    browser,
  }) => {
    const { drills, user } = await createMistakeLearner({ causes: ["guess"] });
    const statement = `The first amount is greater.\n\n| Reference | Amount |\n| --- | ---: |\n| \`${"reference".repeat(24)}\` | 120 |`;

    await prisma.item.update({
      data: {
        content: {
          context: null,
          isTrue: true,
          misconception: null,
          reason: "Compare the amounts.",
          statement,
        },
        format: "trueFalse",
      },
      where: { id: drills[0]!.original.id },
    });

    const context = await browser.newContext({
      hasTouch: true,
      storageState: user.storageState,
      viewport: { height: 844, width: 390 },
    });

    const page = await context.newPage();
    await page.goto("/mistakes/practice");
    const region = page.getByRole("region", { exact: true, name: "Reference, Amount" });
    await expect(region).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );

    expect(await region.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
      await region.evaluate((element) => element.clientWidth),
    );

    const box = await region.boundingBox();
    expect(box).not.toBeNull();
    const y = box!.y + box!.height / 2;
    const session = await context.newCDPSession(page);

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: 300, y }],
      type: "touchStart",
    });

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: 230, y }],
      type: "touchMove",
    });

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: 120, y }],
      type: "touchMove",
    });

    await session.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);

    await region.evaluate((element) => {
      element.scrollLeft = 0;
    });

    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await page.getByRole("radio", { exact: true, name: "True" }).click();
    await expect(page.getByRole("radio", { exact: true, name: "True" })).toBeChecked();
    await context.close();
  });

  test("leads with what's left to fix, shows each skill's mistakes beside the list, and the fixed ones", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.goto("/mistakes");

      // The page's name as its title, with how many are left to fix and fixed under it.
      await expect(
        page.getByRole("heading", { level: 1, name: "Mistakes notebook" }),
      ).toBeVisible();

      await expect(page.getByText("3 ready to practice · 1 fixed", { exact: true })).toBeVisible();

      // On a laptop the sidebar lists the notebook, so its page has no bar inventing a parent for it.
      await expect(page.locator('[data-slot="learn-page-bar"]')).toBeHidden();

      // On a laptop the sidebar marks the notebook's own link rather than a tab.
      const sidebar = page.getByRole("complementary", { name: "Sidebar" });

      await expect(
        sidebar
          .getByRole("navigation", { name: "Study" })
          .getByRole("link", { name: /^Mistakes notebook/u }),
      ).toHaveAttribute("aria-current", "page");

      await expect(sidebar.getByRole("link", { name: /^Today/u })).not.toHaveAttribute(
        "aria-current",
      );

      await expect(page.getByRole("link", { name: "Practice mistakes" })).toHaveAttribute(
        "href",
        "/mistakes/practice",
      );

      await expectAccessibleScreen(page, "the mistakes notebook");

      // An inbox: each skill with its count, the newest one's mistakes beside the list, the
      // others' waiting behind their rows.
      const inbox = page.locator('[data-slot="mistakes-inbox"]');
      const entries = page.locator('[data-slot="mistake-entry"]');
      const shirt = entries.filter({ hasText: "Uma camisa de" });
      const discount = inbox.getByRole("button", { name: /^Calcular o preço com desconto/u });

      await expect(discount).toContainText("1");
      await expect(entries.filter({ hasText: "Uma lanterna usa" })).toContainText("Content gap");

      // Each mistake to fix practices its skill's mistakes alone, and goes back to the lesson that
      // teaches it.
      const flashlight = entries.filter({ hasText: "Uma lanterna usa" });

      await expect(flashlight.getByRole("link", { name: "Practice this skill" })).toHaveAttribute(
        "href",
        /\/mistakes\/practice\?skill=[\da-f-]{36}$/u,
      );

      await expect(flashlight.getByRole("link", { name: "Open the lesson" })).toHaveAttribute(
        "href",
        /\/learn\/[\da-f-]{36}$/u,
      );

      await expect(shirt).toBeHidden();

      // A skill opens from the keyboard, and each mistake says why it happened, its answers drawn
      // as the lesson checked them.
      await discount.focus();
      await page.keyboard.press("Enter");
      await expect(discount).toHaveAttribute("aria-expanded", "true");
      await expect(shirt).toContainText("Misread");
      await expect(shirt).toContainText("You answered: R$ 18");
      await expect(shirt).toContainText("Right answer: R$ 102");
      await expect(shirt.getByText("Your answer", { exact: true })).toBeVisible();
      await expect(shirt.getByText("Correct", { exact: true })).toBeVisible();

      await inbox.getByRole("button", { name: /^Combinar variações percentuais/u }).click();

      await expect(entries.filter({ hasText: "Um investidor aplicou" })).toContainText(
        "Fell for a trap",
      );

      await expect(shirt).toBeHidden();

      // The fixed ones are the notebook's other tab.
      const tabs = page.getByRole("navigation", { name: "Mistakes" });

      await expect(tabs.getByRole("link", { name: /^To fix/u })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await tabs.getByRole("link", { name: /^Fixed/u }).click();
      await expect(page).toHaveURL(/\/mistakes\?status=fixed$/u);

      await expect(tabs.getByRole("link", { name: /^Fixed/u })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // A notebook with one skill shows it.
      await expect(entries.filter({ hasText: "Fixed" })).toHaveCount(1);
      await expect(entries.filter({ hasText: "Fixed" })).toBeVisible();

      // A fixed one has nothing left to practice.
      await expect(
        entries.filter({ hasText: "Fixed" }).getByRole("link", { name: "Practice this skill" }),
      ).toHaveCount(0);

      await tabs.getByRole("link", { name: /^To fix/u }).click();
      await expect(page).toHaveURL(/\/mistakes$/u);
    });
  });

  test("practices one skill's mistakes, and asks the buddy about a question without leaving it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      const asked = await stubScreenTutor(page);
      const options = page.getByRole("radio", { name: "1,0 A" });

      await page.goto("/mistakes");

      await page
        .getByRole("region", { name: "Resolver circuitos em série" })
        .getByRole("link", { name: "Practice this skill" })
        .click();

      // Only the circuit's mistake: the oldest one, a misread discount, stays out.
      await expect(page).toHaveURL(/\/mistakes\/practice\?skill=[\da-f-]{36}$/u);
      await expect(page.getByText("Read every word before you answer.")).toBeHidden();
      await expect(options).toBeVisible();

      // On a laptop the aside says why the mistake happened and how its drill goes, beside the
      // question instead of over it, and the buddy waits at its foot.
      const help = page.getByRole("complementary", { name: "Help with this question" });
      await expect(help.getByText("Content gap")).toBeVisible();
      await expect(help.getByText("A few questions on an idea you missed.")).toBeVisible();

      await expect(
        page.locator('[data-slot="task-body"]').getByText("A few questions on an idea you missed."),
      ).toBeHidden();

      await expect(help.getByRole("textbox", { name: "Ask a question" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ask Zu" })).toBeHidden();

      // On a phone the drill's note sits above the question, and the buddy opens over the
      // question's foot, quoting it; opening asks nothing.
      await page.setViewportSize({ height: 844, width: 390 });

      await expect(
        page.locator('[data-slot="task-body"]').getByText("A few questions on an idea you missed."),
      ).toBeVisible();

      await page.getByRole("button", { name: "Ask Zu" }).click();

      const tutor = page.getByRole("dialog", { name: "Zu" });

      await expect(
        tutor.getByText("About “Qual é a corrente elétrica no circuito?”"),
      ).toBeVisible();

      expect(asked).toStrictEqual([]);
      await tutor.getByRole("button", { name: "What is this question asking?" }).click();

      await expect(
        tutor.getByText("Here's the short version, from what the screen shows."),
      ).toBeVisible();

      expect(asked).toStrictEqual([
        {
          input: expect.objectContaining({
            context: { answered: false, kind: "item" },
            question: "What is this question asking?",
          }),
          path: expect.stringMatching(/^\/v1\/items\/[\da-f-]{36}\/questions$/u),
        },
      ]);

      // Escape closes the buddy first; the question is still there to answer.
      await page.keyboard.press("Escape");
      await expect(tutor).toBeHidden();
      await expect(options).toBeVisible();

      // Back on the question, Escape leaves practice, like a session's block: nothing answered,
      // nothing lost.
      await page.getByRole("heading", { name: "Qual é a corrente elétrica no circuito?" }).click();
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/mistakes$/u);
    });
  });

  test("practice drills a mistake by its cause and gives the why, by keyboard", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const attemptsBefore = await prisma.attempt.count({ where: { userId: user.id } });
      const right = page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!");

      await page.goto("/mistakes");
      await expect(page.getByText("3 ready to practice · 1 fixed", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Practice mistakes" }).click();

      // Beside the question, the aside says how the drill goes and shows the mistake as it was
      // made. Its own question (a number to type) can't be asked here, so the earlier answer
      // shows under that question, never next to the one in view, where it would mislead.
      const aside = page.getByRole("complementary", { name: "Help with this question" });

      await expect(aside.getByText("Read every word before you answer.")).toBeVisible();
      await expect(aside.getByText("Misread")).toBeVisible();
      await expect(aside).toContainText("Uma camisa de");
      await expect(aside.locator('[data-slot="mistake-answer"]')).toContainText("R$ 18");
      await expect(page.getByText(/^Last time you answered/u)).toBeHidden();

      // A misread is drilled by reading first: the answers show once the question is read.
      await expect(page.getByRole("radio", { name: "R$ 2.040" })).toBeHidden();

      // Keys work once the page hydrates, so the first press retries. Enter shows the answers of
      // a question read first, then a number picks (a second press would clear it).
      await expect(async () => {
        await page.keyboard.press("Enter");
        await expect(page.getByRole("radio", { name: "R$ 2.040" })).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 5000 });

      await page.keyboard.press("2");
      await expect(page.getByRole("radio", { checked: true, name: "R$ 2.040" })).toBeVisible();

      // Enter checks, then goes on.
      await checkWithEnter(page);
      await expect(right).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(right).toBeHidden();

      await expect
        .poll(async () => prisma.attempt.count({ where: { userId: user.id } }))
        .toBe(attemptsBefore + 1);
    });
  });

  // On a content gap's idea screen Ana's aside showed only her answer ("3,0 A"): the question it
  // was made on waits behind the idea, so the aside shows it until the question is in view.
  test("a content gap's idea screen shows the question the mistake was made on", async ({
    browser,
  }) => {
    const { drills, user } = await createMistakeLearner({ causes: ["gap"] });
    const page = await openAs(browser, user);
    const aside = page.getByRole("complementary", { name: "Help with this question" });
    const question = drillQuestion("gap", "original");
    const context = "A tree casts a 12 m shadow while a 2 m post casts a 3 m shadow.";

    await prisma.mistake.update({
      data: {
        snapshot: {
          answer: "Wrong answer",
          context,
          question,
          visual: {
            events: [
              { date: "09:00", detail: null, label: "Measure the post" },
              { date: "09:05", detail: null, label: "Measure the tree" },
            ],
            kind: "timeline",
            title: "Shadow measurements",
          },
        },
      },
      where: { id: drills[0]?.mistake.id },
    });

    await page.goto("/mistakes");
    await expect(page.getByText(context)).toBeVisible();
    await expect(page.getByText("Shadow measurements", { exact: true })).toBeVisible();

    await page.goto("/mistakes/practice");
    await expect(page.getByText(LESSON_IDEA)).toBeVisible();

    await expect(aside.getByText(question)).toBeVisible();
    await expect(aside.getByText(context)).toBeVisible();
    await expect(aside.getByText("Shadow measurements", { exact: true })).toBeVisible();
    await expect(aside.locator('[data-slot="mistake-answer"]')).toContainText("Wrong answer");

    await page.getByRole("button", { name: /^Start the questions/u }).click();
    // The very first digit works on the new question, without waiting for a refresh tail.
    await page.keyboard.press("1");
    await expect(page.getByRole("radio", { name: "Right answer" })).toBeChecked();
    await expect(page.getByRole("button", { name: /^Check/u })).toBeEnabled();
    await expect(page.getByRole("heading", { name: question })).toBeVisible();
    await expect(aside.getByText(question)).toBeHidden();

    await page.context().close();
  });

  test("keeps a mock recording's transcript in the notebook and out of the next drill's idea aside", async ({
    browser,
  }) => {
    const { drills, goal, user } = await createMistakeLearner({ causes: ["gap"] });
    const drill = drills[0];

    if (!drill) {
      throw new Error("Expected the content-gap mistake");
    }

    const [audio, blueprint] = await Promise.all([
      mediaAssetFixture({ durationMs: 1000, kind: "audio", url: toneUrl(1) }),
      listeningBlueprintFixture({ name: `Listening snapshot ${goal.id}` }),
    ]);

    const content = listeningContent({ plays: 1, uniqueLine: "My booking number is 1234." });

    const recording = await listeningSetFixture({
      content,
      examBlueprintId: blueprint.id,
      mediaAssetId: audio.id,
    });

    /** Handed-in mocks keep revealed support; the next drill reads the same bank set unrevealed. */
    const savedSet = {
      count: 1,
      id: recording.id,
      kind: "audio",
      listening: {
        audio: { durationMs: 1000, url: audio.url },
        plays: 1,
        task: content.task,
        title: content.title,
        transcript: content.script.turns.map((turn) => ({
          speaker: turn.speaker,
          text: turn.text,
        })),
      },
      position: 0,
      source: null,
      text: null,
      title: content.title,
      visual: null,
    };

    await Promise.all([
      prisma.goal.update({
        data: { examBlueprintId: blueprint.id, kind: "exam", targetLanguage: "en" },
        where: { id: goal.id },
      }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ milestone: null, name: "Listening basics" }],
            skills: [
              {
                area: "Listening",
                lessons: 1,
                name: drill.skill.name,
                phase: 0,
                skillId: drill.skill.id,
                weight: null,
              },
            ],
          },
        },
        where: { goalId: goal.id },
      }),
      prisma.item.update({
        data: { examBlueprintId: blueprint.id, setId: recording.id, setPosition: 0 },
        where: { id: drill.original.id },
      }),
      prisma.mistake.update({
        data: {
          snapshot: {
            answer: "Wrong answer",
            question: drillQuestion("gap", "original"),
            set: savedSet,
          },
        },
        where: { id: drill.mistake.id },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/mistakes");

    await expect(
      page.getByText("Listen again as often as you like.", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Transcript" }).click();

    await expect(
      page.getByText("I'd like to book the small hall, please. My booking number is 1234.", {
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole("link", { exact: true, name: "Practice this skill" }).click();
    await expect(page.getByText(LESSON_IDEA)).toBeVisible();
    const aside = page.getByRole("complementary", { name: "Help with this question" });
    await expect(aside).toBeVisible();
    await expect(aside.getByText(drillQuestion("gap", "original"), { exact: true })).toBeVisible();
    await expect(aside.getByRole("region", { exact: true, name: "Recording" })).toHaveCount(0);
    await expect(aside.getByRole("button", { exact: true, name: "Transcript" })).toHaveCount(0);

    await page.getByRole("button", { name: /^Start the questions/u }).click();

    await expect(
      page.getByRole("heading", { name: drillQuestion("gap", "original") }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { exact: true, name: "Play the recording" }),
    ).toBeVisible();

    await expect(
      page.getByText("You hear it once, like in the exam. Read the questions first.", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(page.getByRole("button", { exact: true, name: "Transcript" })).toHaveCount(0);
    await page.context().close();
  });

  test("a practice that completes the day's last mission says so at its end, with the +50", async ({
    browser,
  }) => {
    const { goal, user } = await createMistakeLearner({ causes: ["trap"] });

    const session = await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [{ anchor: {}, kind: "fixMistake", opens: { kind: "mistakesPractice" }, total: 1 }],
        version: 1,
      },
      userId: user.id,
    });

    await studySessionBlockFixture({ kind: "review", sessionId: session.id, status: "completed" });

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 390 });
    await page.goto("/today");
    await expect(page.getByRole("link", { name: /0 of 1 missions today/u })).toBeVisible();
    await page.getByRole("link", { name: /^Fix a mistake,/u }).click();
    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
    ).toBeVisible();

    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();

    const moment = page.getByRole("status").filter({ hasText: "Mission done:" });
    await expect(moment).toContainText("Mission done: Fix a mistake");
    await expect(moment.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "+50 Brain Power" })).toHaveCount(1);

    await expect(moment.getByRole("listitem")).toHaveText([
      "Mistakes fixed 1",
      "Right answers 1/1",
      "Brain Power +2",
    ]);

    await expect(
      prisma.learningEvent.findMany({
        select: { brainPower: true },
        where: { lessonKind: "mistakePractice", userId: user.id },
      }),
    ).resolves.toStrictEqual([{ brainPower: 2 }]);

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: 52n });

    await captureMissionEnding(page, test.info(), "notebook");
    await expect(page.getByRole("progressbar", { name: /^Question /u })).toHaveCount(0);
    await expect(moment).toContainText("from today's missions");
    await page.setViewportSize({ height: 900, width: 390 });
    await page.getByRole("link", { exact: true, name: "Back" }).click();
    await page.getByRole("link", { exact: true, name: "Today" }).filter({ visible: true }).click();

    await expect(
      page.getByRole("link", { name: /1 of 1 missions today/u }).filter({ visible: true }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /1 of 1 missions today/u })
      .filter({ visible: true })
      .click();

    await expect(page.getByRole("button", { name: /1 of 1 missions/u })).toBeVisible();

    await expect(
      page.getByRole("link", { name: /1 of 1 missions today/u }).filter({ visible: true }),
    ).toBeVisible();

    await page.context().close();
  });

  test("an unknown answer keeps the notebook entry without a trap or a correction claim", async ({
    browser,
  }, testInfo) => {
    const { drills, user } = await createMistakeLearner({ causes: ["trap"] });
    const page = await openAs(browser, user);
    const trapRule = page.getByText("There's a trap in here. Find it before you answer.");
    const fixesIt = page.getByText("One right answer fixes it.");
    const aside = page.getByRole("complementary", { name: "Help with this question" });

    await page.goto("/mistakes/practice");
    await expect(trapRule.filter({ visible: true })).toBeVisible();
    await expect(fixesIt).toBeVisible();

    await page.getByRole("button", { name: "I don't know yet" }).click();
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect(feedback.getByText("I don't know yet")).toBeVisible();
    await expect(feedback.getByText("Not quite")).toBeHidden();
    await expect(feedback.getByText(TRAP)).toBeHidden();
    await expect(feedback.getByText("Mistake fixed. It leaves your notebook.")).toBeHidden();

    // Graded, the drill's rule and what fixes it go, beside the question and above it on a phone:
    // a blank answer looked for no trap. What happened last time stays.
    await expect(trapRule).toHaveCount(0);
    await expect(fixesIt).toHaveCount(0);
    await expect(aside.getByText("This time", { exact: true })).toHaveCount(0);
    await expect(aside.getByText("Fell for a trap")).toBeVisible();
    await expect(page.getByText("Last time you answered: Wrong answer")).toHaveCount(1);

    await captureUnknownFeedback({ colorScheme: "light", page, testInfo, width: 390 });
    await captureUnknownFeedback({ colorScheme: "dark", page, testInfo, width: 390 });
    await captureUnknownFeedback({ colorScheme: "light", page, testInfo, width: 1440 });
    await captureUnknownFeedback({ colorScheme: "dark", page, testInfo, width: 1440 });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: drills[0]?.mistake.id } }),
    ).resolves.toMatchObject({ cause: "gap", status: "open" });

    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();
    const done = page.getByRole("status").filter({ hasText: "Practice done" });
    await expect(done.getByText("Right answers 0/1")).toBeVisible();
    await expect(done.getByText("Mistakes fixed")).toBeHidden();
    await page.getByRole("link", { exact: true, name: "Back" }).click();
    await expect(page.getByText("Content gap", { exact: true })).toBeVisible();
    await page.context().close();
  });

  test("practice counts toward today, stopped early too", async ({ browser }) => {
    const { user } = await createMistakeLearner({ causes: ["trap", "guess"] });
    const page = await openAs(browser, user);

    await page.goto("/activity");
    await expect(page.getByText(/start learning to track your progress/iu)).toBeVisible();

    await page.goto("/mistakes/practice");

    await expect(
      page
        .getByText("There's a trap in here. Find it before you answer.")
        .filter({ visible: true }),
    ).toBeVisible();

    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    // A correct answer did not fall for a trap.
    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
    ).toBeVisible();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText(TRAP),
    ).toBeHidden();

    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();

    const done = page.getByRole("status").filter({ hasText: "Practice done" });
    await expect(done.getByRole("heading", { level: 2, name: "Practice done" })).toBeVisible();

    // What the run did, as tiles, with one way back.
    const facts = done.getByRole("listitem");
    await expect(facts).toHaveText(["Mistakes fixed 1", "Right answers 1/1", "Brain Power +2"]);

    await expectAccessibleScreen(page, "a practice's end");

    const back = page.getByRole("link", { exact: true, name: "Back" });
    await expect(back).toHaveAttribute("href", /\/mistakes$/u);

    // From `lg` the way back is as wide as its label, like every task's main action, not a banner.
    const backBox = await back.boundingBox();
    expect(backBox?.width).toBeLessThan(320);

    await expect
      .poll(() =>
        prisma.learningEvent.findMany({
          select: { brainPower: true, correctAnswers: true },
          where: { lessonKind: "mistakePractice", userId: user.id },
        }),
      )
      .toStrictEqual([{ brainPower: 2, correctAnswers: 1 }]);

    await expect
      .poll(() => prisma.dailyProgress.findFirst({ where: { userId: user.id } }))
      .toMatchObject({ brainPowerEarned: 2, correctAnswers: 1, interactiveCompleted: 1 });

    await page.goto("/stats");

    // The overview's study days count the practice day.
    await expect(page.getByRole("main").getByRole("link", { name: "Study days 1" })).toHaveText(
      "1",
    );

    await page.context().close();
  });

  test("after a miss in practice the buddy offers to walk through the answer, beside the main action as in a lesson", async ({
    browser,
  }) => {
    const { user } = await createMistakeLearner({ causes: ["trap"] });
    const page = await openAs(browser, user);
    const asked = await stubScreenTutor(page);
    const ask = page.getByRole("button", { exact: true, name: "Ask Zu" });

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/mistakes/practice");

    await expect(
      page.getByRole("heading", { name: drillQuestion("trap", "original") }),
    ).toBeVisible();

    // Before the answer the buddy is an icon after the main action, as the lesson places it.
    const check = page.getByRole("button", { name: /^Check/u });
    expect(await leftEdge(ask)).toBeGreaterThan(await leftEdge(check));

    await page.getByRole("radio", { name: "Wrong answer" }).click();
    await check.click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Not quite"),
    ).toBeVisible();

    // After a miss it says its name before Continue, when asking helps most.
    const next = page.getByRole("button", { name: /^Continue/u });
    expect(await leftEdge(ask)).toBeLessThan(await leftEdge(next));

    // Beside a checked answer the buddy is asked about the answer, not for a hint: on a laptop in
    // the aside's dock, on a phone in its drawer.
    await page.setViewportSize({ height: 800, width: 1280 });
    const dock = page.getByRole("group", { name: "Suggested questions" });
    await expect(dock.getByRole("button", { name: "Walk me through this answer" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "What is this question asking?" })).toBeHidden();

    await page.setViewportSize({ height: 844, width: 390 });
    await ask.click();
    const tutor = page.getByRole("dialog", { name: "Zu" });
    await tutor.getByRole("button", { name: "Walk me through this answer" }).click();

    await expect(
      tutor.getByText("Here's the short version, from what the screen shows."),
    ).toBeVisible();

    expect(asked).toStrictEqual([
      {
        input: expect.objectContaining({
          context: { answered: true, kind: "item" },
          question: "Walk me through this answer",
        }),
        path: expect.stringMatching(/^\/v1\/items\/[\da-f-]{36}\/questions$/u),
      },
    ]);

    // A run with a miss ends saying the mistake comes back another day, without a green "0/1".
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();
    const done = page.getByRole("status").filter({ hasText: "Practice done" });
    await expect(done.getByRole("listitem")).toHaveText(["Right answers 0/1"]);

    await expect(
      done.getByText("The rest come back another day, when they stick better."),
    ).toBeVisible();

    await page.context().close();
  });

  test("an answer that can't reach the server on a bad connection says so and keeps the answer to check again", async ({
    browser,
  }) => {
    const { user } = await createMistakeLearner({ causes: ["trap"] });
    const page = await openAs(browser, user);
    const check = page.getByRole("button", { name: /^Check/u });
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    const saveError = page.getByRole("main").getByRole("alert");

    await page.goto("/mistakes/practice");
    await page.getByRole("radio", { name: "Right answer" }).click();

    // The connection drops as Check goes: the bar says it wasn't saved, never a Check that spins.
    await page.context().setOffline(true);
    await check.click();

    await expect(saveError).toBeVisible();
    await expect(saveError).toHaveText("We couldn't save that answer. Check it again.");

    await expect(check).toBeEnabled();
    await expect(page.getByRole("radio", { checked: true, name: "Right answer" })).toBeVisible();

    // Back online, the same answer goes through.
    await page.context().setOffline(false);
    await check.click();
    await expect(feedback.getByText("Correct!")).toBeVisible();

    await page.context().close();
  });

  test("shows a sign-in gate to a signed-out visitor of practice", async ({ page }) => {
    await page.goto("/mistakes/practice");

    const gate = page.getByRole("main");
    await expect(gate.getByRole("heading", { level: 1, name: "Log in to continue" })).toBeVisible();

    await expect(gate.getByRole("link", { exact: true, name: "Log in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fmistakes%2Fpractice",
    );

    await expect(page).toHaveURL(/\/mistakes\/practice$/u);
    await expect(page.getByText("Start with a goal")).toBeHidden();
  });

  test("reports a practice question while its keys wait", async ({ browser }) => {
    const { user } = await createMistakeLearner({ causes: ["guess"] });
    const page = await openAs(browser, user);
    const answer = page.getByRole("radio", { name: "Right answer" });

    await page.goto("/mistakes/practice");

    await expect(
      page.getByRole("heading", { name: drillQuestion("guess", "original") }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "I'm not sure" })).toBeVisible();

    // Full screen like a lesson: the task's header, no tabs.
    await expect(page.getByRole("heading", { level: 1, name: "Practice mistakes" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toBeHidden();
    await expect(page.getByRole("progressbar", { name: /^Question 1 of \d+$/u })).toBeVisible();
    await expectAccessibleScreen(page, "practice mistakes");

    // The menu opens from the keyboard, and a number key pressed in it picks no answer.
    await page.getByRole("button", { name: "Question options" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("1");
    await expect(answer).not.toBeChecked();

    // The menu only reports a problem: no votes in the middle of a practice.
    await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Report a problem" }).press("Enter");
    const dialog = page.getByRole("dialog", { name: "Report a problem" });
    await expect(dialog.getByText("This screen is attached")).toBeVisible();

    // A number key pressed while the form is open picks nothing underneath it either.
    await page.keyboard.press("1");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(answer).not.toBeChecked();

    // Once the form is closed and focus is back on the menu's button, number keys answer again.
    await expect(page.getByRole("button", { name: "Question options" })).toBeFocused();
    await page.keyboard.press("1");
    await expect(answer).toBeChecked();
    await page.context().close();
  });
});
