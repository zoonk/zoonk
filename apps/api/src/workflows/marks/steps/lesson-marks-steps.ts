import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { drawLessonIcon, failLessonIcon, findIconsById } from "@zoonk/core/library/icons/library";
import { type PickedIcon, linkLessonIcons, pickLessonIcons } from "@zoonk/core/library/marks/icons";
import {
  type LessonIconRequest,
  type TaggedLesson,
  tagLessonMarks,
} from "@zoonk/core/library/marks/tag";
import { type GenerationStatus } from "@zoonk/db";

export async function tagLessonMarksStep(input: {
  analytics?: AiGenerationContext;
  lessonId: string;
  wait?: CallWait;
}): Promise<TaggedLesson | null> {
  "use step";

  return tagLessonMarks(input);
}

export async function pickLessonIconsStep(input: {
  analytics?: AiGenerationContext;
  requests: LessonIconRequest[];
  runId: string;
  wait?: CallWait;
}): Promise<PickedIcon[]> {
  "use step";

  return pickLessonIcons(input);
}

/** One icon per step, so a failed drawing retries alone without drawing the others again. */
export async function drawLessonIconStep(input: {
  analytics?: AiGenerationContext;
  iconId: string;
  runId: string;
}): Promise<GenerationStatus | null> {
  "use step";

  return drawLessonIcon(input);
}

export async function failLessonIconStep(input: { iconId: string; runId: string }): Promise<void> {
  "use step";

  await failLessonIcon(input);
}

export async function readIconStatesStep(
  iconIds: string[],
): Promise<{ id: string; status: GenerationStatus }[]> {
  "use step";

  const icons = await findIconsById(iconIds);
  return icons.map(({ id, status }) => ({ id, status }));
}

export async function linkLessonIconsStep(input: {
  lessonId: string;
  picked: PickedIcon[];
}): Promise<void> {
  "use step";

  await linkLessonIcons(input);
}
