import { type GeneratedActivity } from "@zoonk/ai/tasks/lessons/activities";
import {
  type ActivityCreateManyInput,
  type ActivityKind,
  type LessonKind,
  prisma,
} from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { streamError, streamStatus } from "../stream-status";
import { type LessonContext } from "./get-lesson-step";

type ActivityEntry = {
  kind: ActivityKind;
  title: string | null;
  description: string | null;
};

const LANGUAGE_ACTIVITY_KINDS: ActivityKind[] = [
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "languageStory",
  "review",
];

function getCoreActivities(concepts: string[]): ActivityEntry[] {
  const explanations: ActivityEntry[] = concepts.map((concept) => ({
    description: null,
    kind: "explanation",
    title: concept,
  }));

  const fallbackExplanation: ActivityEntry[] =
    explanations.length === 0 ? [{ description: null, kind: "explanation", title: null }] : [];

  const allExplanations = [...fallbackExplanation, ...explanations];

  const background: ActivityEntry = { description: null, kind: "background", title: null };
  const mechanics: ActivityEntry = { description: null, kind: "mechanics", title: null };
  const examples: ActivityEntry = { description: null, kind: "examples", title: null };
  const story: ActivityEntry = { description: null, kind: "story", title: null };
  const challenge: ActivityEntry = { description: null, kind: "challenge", title: null };
  const review: ActivityEntry = { description: null, kind: "review", title: null };
  const quiz: ActivityEntry = { description: null, kind: "quiz", title: null };

  const minConceptsForTwoQuizzes = 4;

  if (concepts.length < minConceptsForTwoQuizzes) {
    return [background, ...allExplanations, quiz, mechanics, examples, story, challenge, review];
  }

  const splitIndex = Math.floor(concepts.length / 2);
  const firstGroup = explanations.slice(0, splitIndex);
  const secondGroup = explanations.slice(splitIndex);

  return [
    background,
    ...firstGroup,
    quiz,
    ...secondGroup,
    quiz,
    mechanics,
    examples,
    story,
    challenge,
    review,
  ];
}

function getLanguageActivities(targetLanguage: string | null): ActivityKind[] {
  if (isTTSSupportedLanguage(targetLanguage)) {
    return LANGUAGE_ACTIVITY_KINDS;
  }

  return LANGUAGE_ACTIVITY_KINDS.filter((kind) => kind !== "listening");
}

function getActivitiesForKind(
  lessonKind: LessonKind,
  customActivities: GeneratedActivity[],
  targetLanguage: string | null,
  concepts: string[],
): ActivityEntry[] {
  if (lessonKind === "core") {
    return getCoreActivities(concepts);
  }

  if (lessonKind === "language") {
    return getLanguageActivities(targetLanguage).map((kind) => ({
      description: null,
      kind,
      title: null,
    }));
  }

  return customActivities.map((activity) => ({
    description: activity.description,
    kind: "custom" as const,
    title: activity.title,
  }));
}

export async function addActivitiesStep(input: {
  concepts: string[];
  context: LessonContext;
  lessonKind: LessonKind;
  customActivities: GeneratedActivity[];
  targetLanguage: string | null;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addActivities" });

  const activitiesToCreate = getActivitiesForKind(
    input.lessonKind,
    input.customActivities,
    input.targetLanguage,
    input.concepts,
  );

  const activitiesData: ActivityCreateManyInput[] = activitiesToCreate.map((activity, index) => ({
    description: activity.description,
    generationStatus: activity.kind === "review" ? "completed" : "pending",
    isPublished: true,
    kind: activity.kind,
    language: input.context.language,
    lessonId: input.context.id,
    organizationId: input.context.organizationId,
    position: index,
    title: activity.title,
  }));

  const { error } = await safeAsync(() => prisma.activity.createMany({ data: activitiesData }));

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "addActivities" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addActivities" });
}
