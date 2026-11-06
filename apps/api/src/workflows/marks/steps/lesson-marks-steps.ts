import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import {
  type IconClaim,
  claimLessonIcons,
  drawLessonIcon,
  failLessonIcon,
} from "@zoonk/core/library/icons/library";
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

/** Its own step, so a retried drawing reads the claim from the run instead of claiming again. */
export async function claimLessonIconsStep(input: {
  needs: IconNeed[];
  runId: string;
}): Promise<IconClaim[]> {
  "use step";

  return claimLessonIcons(input);
}

/** One icon per step, so a failed drawing retries alone without drawing the others again. */
export async function drawLessonIconStep(input: {
  analytics?: AiGenerationContext;
  iconId: string;
  need: IconNeed;
}): Promise<void> {
  "use step";

  await drawLessonIcon(input);
}

export async function failLessonIconStep(iconId: string): Promise<void> {
  "use step";

  await failLessonIcon(iconId);
}

export async function linkLessonIconsStep(input: {
  lessonId: string;
  picked: { iconId: string | null; name: string }[];
}): Promise<void> {
  "use step";

  await linkLessonIcons(input);
}
