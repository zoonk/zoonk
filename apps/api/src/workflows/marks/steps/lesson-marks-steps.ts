import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import { type IconRow, drawLessonIcon, failLessonIcon } from "@zoonk/core/library/icons/library";
import { type PickedIcon, linkLessonIcons, pickLessonIcons } from "@zoonk/core/library/marks/icons";
import {
  type LessonIconRequest,
  type TaggedLesson,
  tagLessonMarks,
} from "@zoonk/core/library/marks/tag";

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
  wait?: CallWait;
}): Promise<PickedIcon[]> {
  "use step";

  return pickLessonIcons(input);
}

/** One icon per step, so a failed drawing retries alone without drawing the others again. */
export async function drawLessonIconStep(input: {
  analytics?: AiGenerationContext;
  need: IconNeed;
}): Promise<IconRow> {
  "use step";

  return drawLessonIcon(input);
}

export async function failLessonIconStep(need: IconNeed): Promise<IconRow> {
  "use step";

  return failLessonIcon(need);
}

export async function linkLessonIconsStep(input: {
  lessonId: string;
  picked: { iconId: string | null; name: string }[];
}): Promise<void> {
  "use step";

  await linkLessonIcons(input);
}
