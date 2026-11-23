import { type ContentFixMediaNeed } from "@zoonk/core/staff/content-fixes/media-schema";
import {
  checkFixPictureStep,
  drawFixPictureStep,
  failFixMediaStep,
  listPendingFixMediaStep,
  planFixPictureStep,
  produceFixIdeaIconStep,
  produceFixMarksStep,
  recordFixClipStep,
  recordFixMediaStep,
  saveFixPictureStep,
} from "./steps/content-fix-media-steps";

async function preparePicture(
  fixId: string,
  need: Extract<ContentFixMediaNeed, { kind: "picture" }>,
) {
  const scene = await planFixPictureStep(need);
  const drawn = await drawFixPictureStep({ need, scene });

  if (!(await checkFixPictureStep({ drawn, need, scene }))) {
    await failFixMediaStep({ fixId, need });
    return;
  }

  await saveFixPictureStep({ drawn, fixId, need, scene });
}

async function prepareItem({ fixId, need }: { fixId: string; need: ContentFixMediaNeed }) {
  try {
    switch (need.kind) {
      case "clip":
        await recordFixClipStep({ fixId, need });
        return;
      case "picture":
        await preparePicture(fixId, need);
        return;
      case "ideaIcon": {
        const result = await produceFixIdeaIconStep({ fixId, media: need });
        await recordFixMediaStep({ fixId, key: need.key, result });
        return;
      }
      case "marks": {
        const result = await produceFixMarksStep(need);
        await recordFixMediaStep({ fixId, key: need.key, result });
        return;
      }
      default:
        return need satisfies never;
    }
  } catch {
    await failFixMediaStep({ fixId, need });
  }
}

export async function prepareContentFixMedia(fixId: string): Promise<void> {
  const needs = await listPendingFixMediaStep(fixId);
  const outcomes = await Promise.allSettled(needs.map((need) => prepareItem({ fixId, need })));
  const failure = outcomes.find((outcome) => outcome.status === "rejected");

  if (failure) {
    throw failure.reason;
  }
}
