import { scoreImageEdges } from "@/lib/image-edges";
import { readEvalImage, saveEvalImage } from "@/lib/image-files";
import { judgeImage } from "@/lib/image-judge";
import { calculateScore } from "@/lib/score-calculation";
import { defineScoreCategories } from "@/lib/score-categories";
import { type Task, type TaskScorer, getJudgeExpectations } from "@/lib/types";
import { generateCourseIcon } from "@zoonk/ai/tasks/courses/icon";
import { type ReadCriterion } from "../plain-language-criterion";
import { type CourseIconInput, TEST_CASES } from "./test-cases";

const TASK_ID = "course-icon";

type CourseIconOutput = { imagePath: string; subject: string };

const subjectCriterion = {
  expectations:
    "The one object tells someone who hasn't started the course what it's about, at a glance, using the description to pick the right meaning of the title. Notice a wrong subject, a generic object that would fit many courses (a book, a lightbulb, a computer), or one only an expert would connect to the subject. A wrong or generic icon tells a visitor the wrong thing about the course they're deciding to start.",
  id: "subject",
  label: "Stands for the subject",
} satisfies ReadCriterion;

const styleCriterion = {
  expectations:
    "The course icon style: exactly one centered object with a clean silhouette, in smooth matte 3D with soft lighting and a subtle shadow, two to four colors, on plain white edge to edge, like an app icon. Notice a scene, a second object or props, a photo, a flat drawing, glossy plastic, a gradient or tinted background, or a frame. Icons sit side by side in the catalog, so one off the style looks broken next to the others.",
  id: "style",
  label: "Icon style",
} satisfies ReadCriterion;

const textCriterion = {
  expectations:
    "No letters, numbers or captions anywhere, including on the object itself. A symbol such as a currency sign is fine; a word or a number isn't. Text on an icon is unreadable at the size it's shown and can be in a language the learner doesn't read.",
  id: "text",
  label: "No text",
} satisfies ReadCriterion;

const scoreCategories = defineScoreCategories([
  {
    ...subjectCriterion,
    expectations: `${subjectCriterion.expectations} A generic object caps this at 5; a wrong subject caps it at 3.`,
    weight: 40,
  },
  {
    ...styleCriterion,
    expectations: `${styleCriterion.expectations} A scene, several objects, props, a photo, a tinted background or a frame caps this at 4.`,
    weight: 40,
  },
  {
    ...textCriterion,
    expectations: `${textCriterion.expectations} Any letters, numbers or captions cap this at 3.`,
    weight: 20,
  },
]);

const scoreCourseIcon: TaskScorer = async ({ output, testCase }) => {
  const { imagePath, subject } = JSON.parse(output) as CourseIconOutput;

  const image = await readEvalImage(imagePath);

  const [judged, edges] = await Promise.all([
    judgeImage({
      expectations: getJudgeExpectations(testCase),
      image,
      scene: subject,
      scoreCategories,
    }),
    scoreImageEdges(image),
  ]);

  const categoryScores = [...(judged.categoryScores ?? []), edges];

  return {
    ...judged,
    categoryScores,
    score: calculateScore({ categoryScores, steps: judged.steps }),
  };
};

async function generate({
  description,
  model,
  runId,
  title,
  useFallback,
}: CourseIconInput & { model: string; runId: string; useFallback?: boolean }) {
  const { data, prompt, provenance } = await generateCourseIcon({
    description,
    model,
    title,
    useFallback,
  });

  const imagePath = await saveEvalImage({
    image: data.image.uint8Array,
    modelId: model,
    runId,
    taskId: TASK_ID,
  });

  return {
    data: { imagePath, subject: `The icon of the course "${title}": ${description}` },
    systemPrompt: "",
    usage: {
      images: provenance.usage.images,
      inputTokens: provenance.usage.inputTokens,
      outputTokens: provenance.usage.outputTokens,
    },
    userPrompt: prompt,
  };
}

export const courseIconTask: Task<CourseIconInput, CourseIconOutput> = {
  criteria: [subjectCriterion, styleCriterion, textCriterion],
  description: "Draw a course's icon: one matte 3D object on white that stands for the subject",
  generate,
  id: TASK_ID,
  name: "Course icon",
  output: "image",
  priorities: {
    comparison: {
      criteria: { style: "counts", subject: "disqualifies", text: "counts" },
      preference: "separates",
      trade: null,
    },
    distribution: "shared",
    first: "cost",
    reads: "Visitors and learners see the course icon",
    reason: "A cheap image reused on every course page; quality must clear the bar",
    waits: "Prepared ahead in a workflow, before a learner needs it",
  },
  score: scoreCourseIcon,
  scoreCategories,
  testCases: TEST_CASES,
};
