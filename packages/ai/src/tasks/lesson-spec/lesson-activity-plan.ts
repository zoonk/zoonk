import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { type LessonExam, formatLessonExams } from "../_utils/lesson-exams";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import activityRules from "./activities.prompt.md";
import promptTemplate from "./lesson-activity-plan.prompt.md";
import {
  type LessonScreen,
  type LessonSpec,
  estimateLessonMinutes,
  isPlannedActivity,
} from "./lesson-spec-rules";

const systemPrompt = promptTemplate.replace("{{ACTIVITIES}}", () => activityRules.trimEnd());

/** The planner's own chain: these are its activity rules, applied to a plan it once wrote. */
const defaultModel = "openai/gpt-6.1-sol";
const fallbackModels = ["openai/gpt-6.1-terra", "anthropic/claude-opus-5.5"] as const;

const schema = z.object({
  screens: z.array(
    z.object({
      activityTemplate: z.string(),
      brief: z.string(),
      screen: z.number().int(),
      visual: z.string().nullable(),
    }),
  ),
});

type ActivityTemplateOption = { id: string; description: string; explore: boolean };

export type PublishedLessonScreen = { kind: string; content: unknown };

export type LessonActivityPlanParams = {
  language: string;
  level: CourseLevel;
  courseTitle: string;
  chapterTitle: string;
  spec: LessonSpec;
  screens: readonly PublishedLessonScreen[];
  activityTemplates: ActivityTemplateOption[];
  exams?: LessonExam[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** `index` is the 0-based plan screen that became an activity. */
export type PlannedActivityChange = { index: number; activityTemplate: string };

function formatPlanScreen(screen: LessonScreen, index: number, spec: LessonSpec): string {
  const skills = screen.skills.flatMap((skill) => spec.skills[skill]?.name ?? []);
  const template = screen.activityTemplate ? ` (template: ${screen.activityTemplate})` : "";

  return [
    `${index + 1}. ${screen.kind}${template}`,
    `   Skills: ${skills.length > 0 ? skills.join("; ") : "none"}`,
    `   Brief: ${screen.brief}`,
  ].join("\n");
}

function formatTemplates(templates: readonly ActivityTemplateOption[]): string {
  return templates
    .map((template) =>
      template.explore
        ? `- ${template.id} (explorable): ${template.description}`
        : `- ${template.id}: ${template.description}`,
    )
    .join("\n");
}

function formatScreens(screens: readonly PublishedLessonScreen[]): string {
  return JSON.stringify(
    screens.map((screen, index) => ({ screen: index + 1, ...screen })),
    null,
    1,
  );
}

function buildUserPrompt(params: LessonActivityPlanParams): string {
  const { spec } = params;

  return `LANGUAGE: ${getPromptLanguageName({ language: params.language })}
LEVEL: ${params.level}
COURSE_TITLE: ${params.courseTitle}
CHAPTER_TITLE: ${params.chapterTitle}
LESSON_TITLE: ${spec.title}
CAN_DO: ${spec.canDo}
${formatLessonExams(params.exams)}
SKILLS:
${spec.skills.map((skill, index) => `${index + 1}. ${skill.name} (${skill.hard ? "hard" : "not hard"}): ${skill.description}`).join("\n")}

PLAN (${spec.screens.length} screens):
${spec.screens.map((screen, index) => formatPlanScreen(screen, index, spec)).join("\n")}

LESSON:
${formatScreens(params.screens)}

ACTIVITY_TEMPLATES:
${formatTemplates(params.activityTemplates)}
`;
}

type Proposed = z.infer<typeof schema>["screens"][number];

function changesScreen({ screen, spec }: { screen: number; spec: LessonSpec }): boolean {
  const planned = spec.screens[screen - 1];

  if (!planned) {
    return false;
  }

  return planned.kind === "check" || (planned.kind === "application" && !planned.activityTemplate);
}

function toPlannedScreen({ change, planned }: { change: Proposed; planned: LessonScreen }) {
  return {
    ...planned,
    activityTemplate: change.activityTemplate,
    brief: change.brief.trim(),
    kind: planned.kind === "application" ? planned.kind : ("activity" as const),
    visual: change.visual?.trim() || null,
    visualKind: "template" as const,
  } satisfies LessonScreen;
}

function sharesTemplateWithNeighbor(screens: readonly LessonScreen[], index: number): boolean {
  const template = screens[index]?.activityTemplate;

  return [screens[index - 1], screens[index + 1]].some(
    (neighbor) => neighbor?.activityTemplate === template,
  );
}

/**
 * Applies only what the rules let change: a check or a plain application becoming an activity with
 * a known template. A change that would put one template on two screens in a row is dropped.
 */
export function applyLessonActivityPlan({
  proposed,
  spec,
  templateIds,
}: {
  proposed: readonly Proposed[];
  spec: LessonSpec;
  templateIds: ReadonlySet<string>;
}): { changes: PlannedActivityChange[]; spec: LessonSpec } {
  const accepted = new Map(
    proposed
      .filter(
        (change) =>
          templateIds.has(change.activityTemplate) &&
          changesScreen({ screen: change.screen, spec }),
      )
      .map((change) => [change.screen - 1, change] as const),
  );

  const screens = spec.screens.map((planned, index) => {
    const change = accepted.get(index);
    return change ? toPlannedScreen({ change, planned }) : planned;
  });

  const kept = screens.map((screen, index) =>
    accepted.has(index) && sharesTemplateWithNeighbor(screens, index)
      ? (spec.screens[index] ?? screen)
      : screen,
  );

  const changes = kept.flatMap((screen, index) =>
    accepted.has(index) && isPlannedActivity(screen) && screen.activityTemplate
      ? [{ activityTemplate: screen.activityTemplate, index }]
      : [],
  );

  return {
    changes,
    spec: {
      ...spec,
      estimatedMinutes: estimateLessonMinutes(kept.map((screen) => screen.kind)),
      screens: kept,
    },
  };
}

/**
 * Decides which practice screens of a lesson planned before activities were common become the
 * activity that lets the learner do the skill, with the planner's own activity rules. Returns the
 * revised plan; the writer then writes only the changed screens.
 */
export async function planLessonActivities(params: LessonActivityPlanParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "lesson-activity-plan",
  });

  const data = applyLessonActivityPlan({
    proposed: result.output.screens,
    spec: params.spec,
    templateIds: new Set(params.activityTemplates.map((template) => template.id)),
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
