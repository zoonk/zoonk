import { getLessonMapShape } from "@zoonk/ai/tasks/lesson-writer/map";
import { LESSON_MAP_SHAPES } from "@zoonk/ai/tasks/lesson-writer/schema";
import { z } from "zod";
import { type LessonIcon, lessonIconSchema } from "../icons/lesson-icon-contract";
import { explanationSchema } from "../steps/contract/content-schemas";
import { normalizeStepContentValue } from "../steps/contract/normalize-step-content";

const ideaSchema = z
  .object({
    about: z
      .string()
      .nullable()
      .optional()
      .meta({
        description:
          "One line in the lesson's language on what the idea covers, without giving away its answer, for before the lesson (the opening map's popover). Null until the lesson is tagged",
      }),
    icon: lessonIconSchema
      .nullable()
      .optional()
      .meta({
        description: "The idea's icon. Null until it's drawn; only the playable lesson has it",
      }),
    label: z
      .string()
      .min(1)
      .optional()
      .meta({
        description: "The idea's name in 1 to 4 words; maps written before labels have none",
      }),
    text: explanationSchema.meta({ description: "The idea in one complete sentence" }),
  })
  .strict();

/** The lesson map as clients receive it, always with a shape. */
export const lessonMapSchema = z
  .object({
    ideas: z.array(ideaSchema).min(1),
    shape: z
      .enum(LESSON_MAP_SHAPES)
      .meta({
        description:
          "`nested`: each idea is a level inside the next, smallest first. `hub`: ideas under the lesson's title",
      }),
  })
  .strict();

export type LessonMap = z.infer<typeof lessonMapSchema>;

/** Tagging adds `about` and links each idea's icon once it's drawn, while `iconPending`. */
const savedIdeaSchema = ideaSchema
  .omit({ about: true, icon: true })
  .extend({
    about: z.string().optional(),
    iconId: z.uuid().optional(),
    iconPending: z.boolean().optional(),
  });

export type SavedLessonMapIdea = z.infer<typeof savedIdeaSchema>;

/** Saved maps may leave out the shape, which means `hub`. */
const savedLessonMapSchema = z
  .object({ ideas: z.array(savedIdeaSchema).min(1), shape: lessonMapSchema.shape.shape.optional() })
  .strict();

function parseSavedLessonMap(summary: unknown) {
  const parsed = savedLessonMapSchema.safeParse(normalizeStepContentValue(summary));
  return parsed.success ? parsed.data : null;
}

export function readSavedLessonMapIdeas(summary: unknown): SavedLessonMapIdea[] | null {
  return parseSavedLessonMap(summary)?.ideas ?? null;
}

/** Null when the lesson has no map (not written yet, or a kind of lesson without one). */
export function readLessonMap(summary: unknown): LessonMap | null {
  const saved = parseSavedLessonMap(summary);

  if (!saved) {
    return null;
  }

  const ideas = saved.ideas.map(({ label, text }) => (label ? { label, text } : { text }));
  return { ideas, shape: getLessonMapShape({ ideas, shape: saved.shape ?? "hub" }) };
}

/** The map the lesson plays with: every idea has its `about` line and its drawn icon, or null. */
export function readPlayableLessonMap({
  icons,
  summary,
}: {
  icons: ReadonlyMap<string, LessonIcon>;
  summary: unknown;
}): LessonMap | null {
  const map = readLessonMap(summary);
  const saved = parseSavedLessonMap(summary)?.ideas ?? [];

  return (
    map && {
      ...map,
      ideas: map.ideas.map((idea, index) => {
        const { about, iconId } = saved[index] ?? {};
        return { ...idea, about: about ?? null, icon: (iconId && icons.get(iconId)) || null };
      }),
    }
  );
}

export function readLessonMapSentences(summary: unknown): string[] {
  return readLessonMap(summary)?.ideas.map((idea) => idea.text) ?? [];
}
