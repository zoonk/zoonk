import {
  checkFixPicture,
  drawFixPicture,
  failFixMedia,
  listPendingFixMedia,
  planFixPicture,
  produceFixIdeaIcon,
  recordFixClip,
  recordFixMedia,
  storeFixPicture,
} from "@zoonk/core/staff/content-fixes/media";

export async function listPendingFixMediaStep(fixId: string) {
  "use step";
  return listPendingFixMedia(fixId);
}

export async function recordFixClipStep(input: Parameters<typeof recordFixClip>[0]) {
  "use step";
  await recordFixClip(input);
}

export async function produceFixIdeaIconStep(input: Parameters<typeof produceFixIdeaIcon>[0]) {
  "use step";
  return produceFixIdeaIcon(input);
}

export async function planFixPictureStep(input: Parameters<typeof planFixPicture>[0]) {
  "use step";
  return planFixPicture(input);
}

export async function drawFixPictureStep(input: Parameters<typeof drawFixPicture>[0]) {
  "use step";
  return drawFixPicture(input);
}

export async function checkFixPictureStep(input: Parameters<typeof checkFixPicture>[0]) {
  "use step";
  return checkFixPicture(input);
}

export async function saveFixPictureStep(input: Parameters<typeof storeFixPicture>[0]) {
  "use step";
  const result = await storeFixPicture(input);
  await recordFixMedia({ fixId: input.fixId, key: result.key, result });
}

export async function recordFixMediaStep(input: Parameters<typeof recordFixMedia>[0]) {
  "use step";
  await recordFixMedia(input);
}

export async function failFixMediaStep(input: Parameters<typeof failFixMedia>[0]) {
  "use step";
  await failFixMedia(input);
}
