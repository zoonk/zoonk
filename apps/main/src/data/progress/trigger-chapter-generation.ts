import "server-only";
import { triggerWorkflow } from "./trigger-workflow";

/**
 * Chapter-boundary preload uses the normal chapter-generation workflow trigger
 * so it shares the API route's auth, AI-curriculum, subscription, and workflow
 * idempotency checks with the visible chapter generation page.
 */
export async function triggerChapterGeneration(input: {
  chapterId: string;
  cookieHeader: string;
}): Promise<void> {
  await triggerWorkflow({
    body: { chapterId: input.chapterId },
    cookieHeader: input.cookieHeader,
    endpoint: "/v1/workflows/chapter-generation/trigger",
    failureContext: { chapterId: input.chapterId },
    logPrefix: "[triggerChapterGeneration] Workflow trigger failed:",
  });
}
