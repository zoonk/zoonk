import { learnerStaying } from "@/lib/learner/learner-store";

const navigations = { count: 0, next: Promise.withResolvers<null>() };

/** Next.js calls it as each navigation starts (`onRouterTransitionStart`), long before its page shows. */
export function noteNavigationStart(): void {
  navigations.count += 1;
  navigations.next.resolve(null);
  navigations.next = Promise.withResolvers();
}

/**
 * The learner stays while the one the tap was made for (`learner`, the one its page was drawn for,
 * when known) still holds the session and starts no navigation, even one still loading.
 */
export function stayingHere(learner?: string): () => Promise<boolean> {
  const learnerHere = learnerStaying(learner);
  const { count } = navigations;
  return async () => (await learnerHere()) && count === navigations.count;
}

/** A tap that opens something is the learner's newest intent: an open tapped before it gives way. */
export function openingHere(learner?: string): () => Promise<boolean> {
  noteNavigationStart();
  return stayingHere(learner);
}

/**
 * The answer to a request a tap sent, or what the tap resolves to without one: true once the learner
 * left, since the screen they left has nothing to report even when they come back, and false when
 * the request failed while they're still there. It stops waiting as a navigation starts: React holds
 * every navigation until a pending async transition ends, so a tap waiting inside one would hold the
 * learner's tab press until its answer came.
 */
export async function answerHere<T>(
  request: Promise<T>,
  stillHere: () => Promise<boolean>,
): Promise<{ answer: T } | boolean> {
  const answered = await Promise.race([
    request.then(
      (answer) => ({ answer }),
      () => false,
    ),
    navigations.next.promise.then(() => true),
  ]);

  return (await stillHere()) ? answered : true;
}
