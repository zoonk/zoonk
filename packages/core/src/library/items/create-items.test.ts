import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { mockSearchTerms } from "../identity/_test-utils/identity-mocks";
import {
  drawBlankImage,
  drawTestImage,
  mockDrawnImages,
  mockImageScene,
  resetImageModels,
  testScene,
} from "../media/_test-utils/image-mocks";
import {
  generatedMultipleChoice,
  generatedProvenance,
  generatedTypedItem,
} from "./_test-utils/generated-items";
import { discountMath, discountQuestion } from "./_test-utils/math-problems";
import { createItems } from "./create-items";
import { parseItemContent } from "./item-content";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;

const FIGURE_CONTEXT = "Na figura, uma seta aponta para uma organela da célula vegetal.";

/** Fresh image models and uploads for a test that draws: queued results never leak between tests. */
function mockUploads() {
  resetImageModels();
  storeBlobUploads();
}

const figure = {
  alt: "A plant cell with its chloroplast labeled.",
  prompt: "A plant cell with the chloroplast, nucleus and cell wall labeled.",
};

/** A skill in a biology chapter, so its pictures take the subject's palette. */
async function biologySkill() {
  const course = await courseFixture({ title: "Biologia" });

  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id, title: "Célula" }),
    skillFixture({ language: "pt", name: "Organelas da célula vegetal" }),
    courseCategoryFixture({ category: "science", courseId: course.id }),
  ]);

  await prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } });
  return skill;
}

describe(createItems, () => {
  it("stores checked items with their exam, field, difficulty and provenance", async () => {
    const [skill, exam] = await Promise.all([skillFixture(), examBlueprintFixture()]);
    const provenance = generatedProvenance();
    const item = generatedMultipleChoice({ difficulty: "hard" });

    const { created, rejected } = await createItems({
      examBlueprintId: exam.id,
      field: "nursing",
      format: "multipleChoice",
      items: [item],
      language: "pt",
      provenance,
      skillId: skill.id,
    });

    expect(rejected).toStrictEqual([]);
    expect(created).toHaveLength(1);

    expect(created[0]).toMatchObject({
      difficulty: 1,
      examBlueprintId: exam.id,
      field: "nursing",
      format: "multipleChoice",
      generatedAt: new Date(provenance.generatedAt),
      language: "pt",
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
      skillId: skill.id,
    });

    const { difficulty: _difficulty, format: _format, ...expectedContent } = item;

    expect(
      parseItemContent({ content: created[0]!.content, format: "multipleChoice" }),
    ).toStrictEqual({ content: { ...expectedContent, select: 1 }, format: "multipleChoice" });
  });

  it("stores how its exam answers a question: the options picked and how a number is typed", async () => {
    const skill = await skillFixture();
    const [right, wrong] = generatedMultipleChoice().options;
    const second = { ...right!, text: "10/2" };
    const third = { ...wrong!, text: "2" };
    const twoRight = generatedMultipleChoice({ options: [right!, second, wrong!, third] });
    const oneRight = generatedMultipleChoice({ options: [right!, wrong!, third] });

    const picks = await createItems({
      format: "multipleChoice",
      items: [twoRight, oneRight],
      language: "en",
      provenance: generatedProvenance(),
      select: 2,
      skillId: skill.id,
    });

    expect(picks.rejected).toStrictEqual([
      { index: 1, problems: ["Has 1 correct options instead of 2."] },
    ]);

    expect(picks.created.map((item) => item.content)).toStrictEqual([
      expect.objectContaining({ select: 2 }),
    ]);

    const numbers = await createItems({
      entry: { kind: "integer", places: null },
      format: "numeric",
      items: [
        {
          context: null,
          difficulty: "medium",
          format: "numeric",
          math: discountMath,
          otherSolutions: [],
          question: discountQuestion,
        },
      ],
      language: "en",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(numbers.created.map((item) => item.content)).toStrictEqual([
      expect.objectContaining({ entry: { kind: "integer", places: null } }),
    ]);
  });

  it("stores a question about a figure with its picture, leaving the picture's check to the caller, and a retried step stores no copies", async () => {
    mockUploads();
    const skill = await biologySkill();
    const provenance = generatedProvenance();
    const plain = generatedMultipleChoice();
    const pictured = generatedMultipleChoice({ context: FIGURE_CONTEXT, image: figure });

    mockImageScene(testScene({ focalObject: `a plant cell ${randomUUID()}` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    const input = {
      format: "multipleChoice" as const,
      items: [plain, pictured],
      language: "pt",
      provenance,
      skillId: skill.id,
    };

    const { created, rejected, unchecked } = await createItems(input);

    expect(rejected).toStrictEqual([]);

    // The question is asked at once; its new picture's model check follows (`checkImageAsset`).
    expect(checkLessonImage).not.toHaveBeenCalled();
    expect(unchecked).toStrictEqual([created[1]?.mediaAssetId]);

    const rows = await prisma.item.findMany({
      include: { mediaAsset: true },
      orderBy: { createdAt: "asc" },
      where: { id: { in: created.map((item) => item.id) } },
    });

    expect(
      rows.map((row) => [parseItemContent(row).content, row.mediaAsset?.palette]),
    ).toStrictEqual([
      [expect.objectContaining({ image: null, question: plain.question }), undefined],
      [expect.objectContaining({ image: figure, question: pictured.question }), "science"],
    ]);

    await createItems(input);
    await expect(prisma.item.count({ where: { runId: provenance.runId } })).resolves.toBe(2);
  });

  it("leaves out a question whose picture can't be drawn instead of storing it bare", async () => {
    mockUploads();
    const skill = await skillFixture();
    const pictured = generatedMultipleChoice({ context: FIGURE_CONTEXT, image: figure });

    mockImageScene(testScene({ focalObject: `a plant cell ${randomUUID()}` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawBlankImage(), await drawBlankImage()]);

    await expect(
      createItems({
        format: "multipleChoice",
        items: [pictured],
        language: "pt",
        provenance: generatedProvenance(),
        skillId: skill.id,
      }),
    ).resolves.toStrictEqual({
      created: [],
      rejected: [{ index: 0, problems: [expect.stringContaining("picture")] }],
      unchecked: [],
    });
  });

  it("leaves out a private skill's question about a figure, drawing nothing, while the private store isn't set up", async () => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "");
    mockUploads();
    const owner = await userFixture();
    const skill = await skillFixture({ ownerId: owner.id, visibility: "private" });
    const plain = generatedMultipleChoice();
    const pictured = generatedMultipleChoice({ context: FIGURE_CONTEXT, image: figure });
    const sceneSpy = mockImageScene(testScene({ focalObject: `a plant cell ${randomUUID()}` }));
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    const result = await createItems({
      format: "multipleChoice",
      items: [plain, pictured],
      language: "pt",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(result.created).toHaveLength(1);

    expect(result.rejected).toStrictEqual([
      { index: 1, problems: [expect.stringContaining("picture")] },
    ]);

    expect(sceneSpy).not.toHaveBeenCalled();
    expect(drawSpy).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("keeps a statute drill's wording as the law writes it", async () => {
    const skill = await skillFixture({ language: "pt" });

    const drill: ItemOf<"trueFalse"> = {
      context: null,
      difficulty: "medium",
      format: "trueFalse",
      image: null,
      isTrue: true,
      misconception: null,
      reason: "O texto diz: “é assegurado — nos termos da lei — o direito de resposta”.",
      statement: "É assegurado — nos termos da lei — o direito de resposta.",
      visual: null,
    };

    const { created } = await createItems({
      format: "trueFalse",
      items: [drill],
      language: "pt",
      provenance: generatedProvenance(),
      skillId: skill.id,
      sourceCitation: "CF/88, Art. 5º, V",
    });

    expect(created[0]?.content).toMatchObject({ reason: drill.reason, statement: drill.statement });
  });

  it("keeps items that fail the checks out and reports why", async () => {
    const skill = await skillFixture();
    const good = generatedMultipleChoice();

    const twoCorrect = generatedMultipleChoice({
      options: good.options.map((option) => ({ ...option, isCorrect: true })),
    });

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [twoCorrect, good, generatedTypedItem()],
      language: "en",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created.map((item) => parseItemContent(item).content)).toStrictEqual([
      expect.objectContaining({ question: good.question }),
    ]);

    expect(rejected).toStrictEqual([
      { index: 0, problems: ["Has 2 correct options instead of 1."] },
      { index: 2, problems: ["Is typed instead of multipleChoice."] },
    ]);
  });

  it.each([
    {
      language: "pt",
      position: "A resposta é o segundo.",
      reason:
        "Você compara as razões: o primeiro tipo tem 0,6 kg/L e o segundo, 0,75 kg/L. Com o segundo tipo, 80 L comportam 60 kg.",
    },
    {
      language: "es",
      position: "La respuesta es el segundo.",
      reason: "El primer tipo tiene 0,6 kg/L y el segundo, 0,75 kg/L.",
    },
    {
      language: "fr",
      position: "La réponse est le deuxième.",
      reason: "Le premier type contient 0,6 kg/L et le deuxième, 0,75 kg/L.",
    },
    {
      language: "de",
      position: "Die Antwort ist der zweite.",
      reason: "Der erste Typ enthält 0,6 kg/L und der zweite, 0,75 kg/L.",
    },
  ])("stores content ordinals but rejects option positions in $language", async (testCase) => {
    const skill = await skillFixture({ language: testCase.language });
    const good = generatedMultipleChoice();

    const withReason = (reason: string) => ({
      ...good,
      options: good.options.map((option) => (option.isCorrect ? { ...option, reason } : option)),
    });

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [withReason(testCase.reason), withReason(testCase.position)],
      language: testCase.language,
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(rejected).toStrictEqual([
      {
        index: 1,
        problems: [expect.stringContaining("A reason points at an option by its place")],
      },
    ]);

    expect(created).toHaveLength(1);
    const stored = await prisma.item.findMany({ where: { skillId: skill.id } });
    expect(stored).toHaveLength(1);

    expect(stored[0]?.content).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true, reason: testCase.reason }),
      ]),
    });
  });

  it("repairs what code can before storing: Markdown learners would see and an option written twice", async () => {
    const skill = await skillFixture();
    const [right, wrong] = generatedMultipleChoice().options;

    const items = [
      // ENEM placement, Oct 2026: italics split across lines showed their underscores.
      generatedMultipleChoice({
        context: "_Presidente: A audiência é aberta.\nMoradora: Escreveram aqui._",
      }),
      // "5,0" is the right answer written again.
      generatedMultipleChoice({ options: [right!, wrong!, { ...wrong!, text: "5,0" }] }),
    ];

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items,
      language: "pt",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(rejected).toStrictEqual([]);

    const stored = created.map((item) => parseItemContent(item).content);

    expect(stored[0]).toMatchObject({
      context: "Presidente: A audiência é aberta.\nMoradora: Escreveram aqui.",
    });

    expect(stored[1]).toMatchObject({
      options: expect.not.arrayContaining([expect.objectContaining({ text: "5,0" })]),
    });

    expect(stored[1]).toMatchObject({ options: [expect.anything(), expect.anything()] });
  });

  it("never stores what code can't repair: unfinished text, a question left with one option, or data the options miss", async () => {
    const skill = await skillFixture();
    const good = generatedMultipleChoice();
    const [right, wrong] = good.options;

    const items = [
      generatedMultipleChoice({ question: "[Insert the question here]" }),
      generatedMultipleChoice({ options: [right!, { ...wrong!, text: "5,0" }] }),
      generatedMultipleChoice({
        context: "| Sensor | mm |\n|---|---:|\n| A | 49,8 |\n| B | 50,0 |\n| C | 50,3 |",
        options: [
          { ...right!, text: "A" },
          { ...wrong!, text: "B" },
        ],
        question: "Which sensor reads closest to 50 mm?",
      }),
      good,
    ];

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items,
      language: "pt",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created.map((item) => parseItemContent(item).content)).toStrictEqual([
      expect.objectContaining({ question: good.question }),
    ]);

    expect(rejected.map((entry) => entry.index)).toStrictEqual([0, 1, 2]);
    await expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(1);
  });

  it("enforces the exam's option count", async () => {
    const skill = await skillFixture();

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [generatedMultipleChoice()],
      language: "pt",
      optionCount: 5,
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created).toStrictEqual([]);
    expect(rejected).toStrictEqual([{ index: 0, problems: ["Has 2 options instead of 5."] }]);
  });

  it("returns the stored items instead of copies when a workflow step retries, marking plans reading the skill once", async () => {
    const [skill, user] = await Promise.all([skillFixture(), userFixture()]);
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] });
    const provenance = generatedProvenance();
    const items = [generatedTypedItem(), generatedTypedItem({ question: "Another question?" })];

    const params = {
      format: "typed" as const,
      items,
      language: "en",
      provenance,
      skillId: skill.id,
    };

    const first = await createItems(params);
    const retry = await createItems(params);

    expect(retry.created.map((item) => item.id)).toStrictEqual(
      first.created.map((item) => item.id),
    );

    await expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(2);

    // The bank the plan reads changed once: the retry wrote nothing.
    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
      pendingAdaptation: ["content"],
    });
  });

  it("stores each format one run wrote for a skill, and still no copies on a retry", async () => {
    const skill = await skillFixture();
    const provenance = generatedProvenance();
    const shared = { language: "en", provenance, skillId: skill.id };

    const choice = {
      ...shared,
      format: "multipleChoice" as const,
      items: [generatedMultipleChoice()],
    };

    const typed = { ...shared, format: "typed" as const, items: [generatedTypedItem()] };

    await createItems(choice);
    const stored = await createItems(typed);
    const retried = await createItems(typed);

    expect(stored.created).toHaveLength(1);

    expect(retried.created.map((item) => item.id)).toStrictEqual(
      stored.created.map((item) => item.id),
    );

    const formats = await prisma.item.findMany({
      select: { format: true },
      where: { skillId: skill.id },
    });

    expect(formats.map((item) => item.format).toSorted()).toStrictEqual([
      "multipleChoice",
      "typed",
    ]);
  });
});
