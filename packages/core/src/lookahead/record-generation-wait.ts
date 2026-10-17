import "server-only";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { getSession } from "../users/get-session";
import { type GenerationWaitInput } from "./generation-wait-contract";

/**
 * Records one wait for content (Generation Waited, in milliseconds) on the server, so ad blockers
 * can't hide it. Clients report it when the content they waited for is ready, measured from the
 * first waiting screen; the targets are the first lesson of a new goal within placement's time
 * and a p95 under 2 seconds for every lesson after that. A client that doesn't say its platform
 * is recognized from the request.
 */
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
