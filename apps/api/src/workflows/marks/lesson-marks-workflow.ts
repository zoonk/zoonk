import { type CallWait } from "@zoonk/ai/provider-options";
import { type PickedIcon } from "@zoonk/core/library/marks/icons";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { waitForRunToken } from "../_shared/run-token";
import {
  drawLessonIconStep,
  failLessonIconStep,
  linkLessonIconsStep,
  pickLessonIconsStep,
  tagLessonMarksStep,
} from "./steps/lesson-marks-steps";

export type LessonMarksInput = { analytics?: ContentAnalytics; lessonId: string; wait?: CallWait };

export type LessonMarksResult = { drawn: number; failed: number; icons: number };

type IconContext = {
  contentScope: "personal" | "shared";
  distinctId?: string;
  goalId?: string;
  traceId: string;
};

async function drawIcon({
  analytics,
  icon,
}: {
  analytics: IconContext;
  icon: PickedIcon;
}): Promise<{ iconId: string | null; name: string }> {
  try {
    const drawn = await drawLessonIconStep({ analytics, need: icon.need });
    return { iconId: drawn.status === "completed" ? drawn.id : null, name: icon.name };
  } catch {
    await failLessonIconStep(icon.need);
    return { iconId: null, name: icon.name };
  }
}

async function pickIcons({
  lessonId,
  ...input
}: Parameters<typeof pickLessonIconsStep>[0] & { lessonId: string }): Promise<PickedIcon[]> {
  try {
    return await pickLessonIconsStep(input);
  } catch (error) {
    await linkLessonIconsStep({ lessonId, picked: [] });
    throw error;
  }
}

export async function lessonMarksWorkflow({
  analytics,
  lessonId,
  wait,
}: LessonMarksInput): Promise<LessonMarksResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const learner = { distinctId: analytics?.distinctId, goalId: analytics?.goalId };
  await waitForRunToken(`lesson-marks:${lessonId}`);

  const tagged = await tagLessonMarksStep({
    analytics: { ...learner, traceId: workflowRunId },
    lessonId,
    wait,
  });

  if (!tagged || tagged.requests.length === 0) {
    return { drawn: 0, failed: 0, icons: 0 };
  }

  const context = { ...learner, contentScope: tagged.contentScope, traceId: workflowRunId };

  const picked = await pickIcons({ analytics: context, lessonId, requests: tagged.requests, wait });

  const drawn = await Promise.all(
    picked.filter((icon) => !icon.iconId).map((icon) => drawIcon({ analytics: context, icon })),
  );

  await linkLessonIconsStep({
    lessonId,
    picked: [...picked.filter((icon) => icon.iconId), ...drawn],
  });

  return {
    drawn: drawn.filter((icon) => icon.iconId).length,
    failed: drawn.filter((icon) => !icon.iconId).length,
    icons: picked.length,
  };
}
