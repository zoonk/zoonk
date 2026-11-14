import { type GuestSession } from "@/lib/guest/ensure-guest-session";
import { learnerStaying } from "@/lib/learner/learner-store";

const navigations = { count: 0, next: Promise.withResolvers<null>() };

/** Next.js calls it as each navigation starts (`onRouterTransitionStart`), long before its page shows. */
export function noteNavigationStart(): void {
  navigations.count += 1;
  navigations.next.resolve(null);
  navigations.next = Promise.withResolvers();
}

function staysSince(count: number, learner?: string): () => Promise<boolean> {
  const learnerHere = learnerStaying(learner);
  return async () => (await learnerHere()) && count === navigations.count;
}

/**
 * The learner stays while the one the tap was made for (`learner`, the one its page was drawn for,
 * when known) still holds the session and starts no navigation, even one still loading.
 */
export function stayingHere(learner?: string): () => Promise<boolean> {
  return staysSince(navigations.count, learner);
}

/** A tap that opens something is the learner's newest intent: an open tapped before it gives way. */
export function openingHere(learner?: string): () => Promise<boolean> {
  noteNavigationStart();
  return stayingHere(learner);
}

/**
 * An open that signs a visitor in as a guest first: it holds to the learner that sign-in gives, not
 * the visitor who tapped, and counts navigations from the tap, so leaving during the sign-in counts.
 */
export function openingAsGuest(signIn: Promise<GuestSession>): () => Promise<boolean> {
  noteNavigationStart();
  const { count } = navigations;

  return async () => {
    const guest = await signIn;
    return staysSince(count, guest.status === "ready" ? guest.learnerId : undefined)();
  };
}

/**
 * The answer to a request a tap sent, or what the tap resolves to without one: true once the learner
 * left, since the screen they left has nothing to report even when they come back, and false when
 * the request failed while they're still there. It stops waiting as a navigation starts, even while
 * it still checks who holds the session: React holds every navigation until a pending async
 * transition ends, so a tap waiting inside one would hold the learner's tab press until it was done.
 */
export function answerHere<T>(
  request: Promise<T>,
  stillHere: () => Promise<boolean>,
): Promise<{ answer: T } | boolean> {
  const answered = request.then(
    (answer) => ({ answer }),
    () => false as const,
  );

  return Promise.race([
    navigations.next.promise.then(() => true),
    answered.then(async (result) => ((await stillHere()) ? result : true)),
  ]);
}
