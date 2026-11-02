import "server-only";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { getSession } from "../users/get-session";
import { type GenerationWaitInput } from "./generation-wait-contract";

/** Clients report milliseconds from the first waiting screen when content becomes ready; platform defaults to the current request. */
export async function recordGenerationWait(
  input: GenerationWaitInput,
): Promise<{ status: "recorded" | "unauthorized" }> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  await trackLearnerEvents({
    events: [
      {
        name: "Generation Waited",
        properties: { content_kind: input.contentKind, milliseconds: input.milliseconds },
      },
    ],
    locale: input.locale ?? null,
    platform: input.platform,
    userId: session.user.id,
  });

  return { status: "recorded" };
}
