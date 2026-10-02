import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/contract";
import { API_URL } from "@zoonk/utils/url";
import { toOwnFileUrl } from "@zoonk/utils/user-blobs";

const OWN_FILES_URL = `${API_URL}/v1/files`;

/**
 * A stored file's address for API clients: a public file keeps its CDN URL, and a private course's
 * picture points at `GET /v1/files/...`, which only its owner can read.
 */
function toApiFileUrl(url: string): string {
  return toOwnFileUrl({ baseUrl: OWN_FILES_URL, url });
}

type PlayableStep = PlayableLibraryLesson["steps"][number];

function withApiImageUrl(step: PlayableStep): PlayableStep {
  if (!("image" in step) || !step.image) {
    return step;
  }

  return { ...step, image: { ...step.image, url: toApiFileUrl(step.image.url) } };
}

/** A lesson whose screens' pictures API clients can open. */
export function withApiImageUrls(lesson: PlayableLibraryLesson): PlayableLibraryLesson {
  return { ...lesson, steps: lesson.steps.map((step) => withApiImageUrl(step)) };
}
