import { createEntityStepStream } from "@/workflows/_shared/stream-status";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { type StepImage } from "@zoonk/core/steps/contract/image";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type PracticeScenario, type PracticeStep } from "./generate-practice-content-step";

/**
 * Practice now saves one image for the opening scenario plus one image for
 * each multiple-choice question. Keeping that split explicit makes it obvious
 * which uploaded file belongs to which persisted step and fails early if the
 * workflow generated the wrong number of images.
 */
function splitPracticeImages({
  images,
  questionCount,
}: {
  images: StepImage[];
  questionCount: number;
}) {
  const expectedImageCount = questionCount + 1;

  if (images.length !== expectedImageCount) {
    throw new Error("Generated image count does not match practice step count");
  }

  const [scenarioImage, ...questionImages] = images;

  if (!scenarioImage) {
    throw new Error("Practice scenario image is missing");
  }

  return { questionImages, scenarioImage };
}

/**
 * Practice activities now open with a static scenario screen so the player can
 * reuse the generic static-step renderer instead of learning a practice-only
 * intro shape. That intro also carries the first generated scene image so the
 * learner starts with a visual setup instead of a text wall.
 */
function buildPracticeScenarioRecord({
  activityId,
  image,
  scenario,
}: {
  activityId: string;
  image: StepImage;
  scenario: PracticeScenario;
}) {
  return {
    activityId,
    content: assertStepContent("static", {
      image,
      text: scenario.text,
      title: scenario.title,
      variant: "intro" as const,
    }),
    isPublished: true,
    kind: "static" as const,
    position: 0,
  };
}

/**
 * Practice questions stay as the existing `multipleChoice` core steps. Their
 * positions start after the static scenario so navigation and completion stay
 * aligned with the visible player order, while each question owns its own
 * artifact image inside the same step content.
 */
function buildPracticeQuestionRecords({
  activityId,
  images,
  steps,
}: {
  activityId: string;
  images: StepImage[];
  steps: PracticeStep[];
}) {
  return steps.map((step, index) => {
    const image = images[index];

    if (!image) {
      throw new Error("Practice question image is missing");
    }

    const content = assertStepContent("multipleChoice", {
      context: step.context,
      image,
      kind: "core",
      options: step.options,
      question: step.question,
    });

    return {
      activityId,
      content,
      isPublished: true,
      kind: "multipleChoice" as const,
      position: index + 1,
    };
  });
}

/**
 * Saving practice activity content needs one ordered record list because the DB
 * write happens through a single `createMany` call. Building the full list here
 * keeps the persistence order obvious: scenario first, then questions.
 */
function buildPracticeStepRecords({
  activityId,
  images,
  scenario,
  steps,
}: {
  activityId: string;
  images: StepImage[];
  scenario: PracticeScenario;
  steps: PracticeStep[];
}) {
  const { questionImages, scenarioImage } = splitPracticeImages({
    images,
    questionCount: steps.length,
  });

  return [
    buildPracticeScenarioRecord({ activityId, image: scenarioImage, scenario }),
    ...buildPracticeQuestionRecords({
      activityId,
      images: questionImages,
      steps,
    }),
  ];
}

/**
 * Persists all practice step records and marks the activity as completed.
 *
 * This is the single save point for a practice entity.
 * The upstream `generatePracticeContentStep` produces data only.
 */
export async function savePracticeActivityStep({
  activityId,
  images,
  scenario,
  steps,
  title,
  workflowRunId,
}: {
  activityId: string;
  images: StepImage[];
  scenario: PracticeScenario;
  steps: PracticeStep[];
  title: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createEntityStepStream<ActivityStepName>(activityId);

  await stream.status({ status: "started", step: "savePracticeActivity" });

  const { data: stepRecords, error: buildError } = await safeAsync(async () =>
    buildPracticeStepRecords({ activityId, images, scenario, steps }),
  );

  if (buildError || !stepRecords) {
    throw buildError ?? new Error("Failed to build practice step records");
  }

  const { error } = await safeAsync(() =>
    prisma.$transaction([
      prisma.step.createMany({ data: stepRecords }),
      prisma.activity.update({
        data: { generationRunId: workflowRunId, generationStatus: "completed", title },
        where: { id: activityId },
      }),
    ]),
  );

  if (error) {
    throw error;
  }

  await stream.status({ status: "completed", step: "savePracticeActivity" });
}
