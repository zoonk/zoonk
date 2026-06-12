import { getPostHogConfig } from "@/lib/posthog";
import { track as trackVercelEvent } from "@vercel/analytics";
import { getCappedLessonDurationSeconds } from "@zoonk/core/player/contracts/completion-duration";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import posthog from "posthog-js";

type PlayerEventInput = {
  courseSlug: string;
  lessonKind: LessonKind;
  lessonSlug: string;
  stepCount: number;
};

export type FeedbackValue = "upvote" | "downvote";

export type FeedbackTarget =
  | { courseSlug: string; kind: "course" }
  | { chapterSlug: string; courseSlug: string; kind: "chapter" }
  | { chapterSlug: string; courseSlug: string; kind: "lesson"; lessonSlug: string }
  | { kind: "courseSuggestions"; locale: string; prompt: string };

type FeedbackInput = FeedbackTarget & { feedback: FeedbackValue };

type AnalyticsEventProperties = Record<string, boolean | number | string>;

const FEEDBACK_VALUES: ReadonlySet<string> = new Set<FeedbackValue>(["upvote", "downvote"]);

const googleAdsSubscriptionConversionId =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIPTION_CONVERSION_ID;

type GoogleTagScope = typeof globalThis & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/**
 * Keeps menu values constrained to analytics values so malformed dropdown
 * events cannot send arbitrary feedback labels.
 */
export function isFeedbackValue(value: string): value is FeedbackValue {
  return FEEDBACK_VALUES.has(value);
}

/**
 * Records generated-content reactions with human-readable identifiers so
 * analytics can be inspected without looking up database ids.
 */
export function trackFeedback(input: FeedbackInput) {
  trackEvent({ name: "Feedback", properties: getFeedbackEventData(input) });
}

/**
 * Records only submitted command-palette searches because the shared search
 * hook debounces before calling the `onSearch` callback.
 */
export function trackCommandPaletteSearch({ searchTerm }: { searchTerm: string }) {
  const trimmedSearchTerm = searchTerm.trim();

  if (!trimmedSearchTerm) {
    return;
  }

  trackEvent({ name: "Command Palette Search", properties: { searchTerm: trimmedSearchTerm } });
}

/**
 * Counts learners who reached the first playable step after the player shell
 * mounted, which is the funnel denominator for later player events.
 */
export function trackPlayerLoaded(input: PlayerEventInput) {
  trackEvent({ name: "Player Loaded", properties: getPlayerEventData(input) });
}

/**
 * Counts learners who moved beyond the first step without depending on a
 * specific step renderer or interaction type.
 */
export function trackPlayerSecondStep(input: PlayerEventInput) {
  trackEvent({ name: "Player Second Step", properties: getPlayerEventData(input) });
}

/**
 * Reports lesson completions with the client-side duration because the player
 * already owns the local lesson start timestamp before persistence runs.
 */
export function trackLessonCompleted({
  startedAt,
  ...input
}: PlayerEventInput & { startedAt: number }) {
  trackEvent({
    name: "Lesson Completed",
    properties: {
      ...getPlayerEventData(input),
      durationSeconds: getCompletionDurationSeconds({ startedAt }),
    },
  });
}

/**
 * Reports completed subscription checkouts after Stripe confirms the purchase
 * so analytics count real conversions instead of checkout button clicks.
 */
export function trackGoogleAdsSubscriptionConversion() {
  trackEvent({ name: "Subscription Conversion" });

  if (!googleAdsSubscriptionConversionId) {
    return;
  }

  getGoogleTag()("event", "conversion", { send_to: googleAdsSubscriptionConversionId });
}

/**
 * Uses the same global queue shape as Google's snippet so conversion events are
 * not coupled to Next's module-scoped helper state. The Google tag script drains
 * this queue after it loads, so the event is still recorded if checkout returns
 * before the remote script has finished loading.
 */
function getGoogleTag() {
  const scope = getGoogleTagScope();
  scope.dataLayer ??= [];
  scope.gtag ??= queueGoogleTagArguments;

  return scope.gtag;
}

/**
 * Narrows the browser global to the Google tag fields without making every
 * TypeScript consumer in the app believe those fields always exist.
 */
function getGoogleTagScope(): GoogleTagScope {
  return globalThis as GoogleTagScope;
}

/**
 * Matches Google's queueing contract while using rest parameters so the
 * function can be shared safely by linted app code.
 */
function queueGoogleTagArguments(...args: unknown[]) {
  getGoogleTagScope().dataLayer?.push(args);
}

/**
 * Sends each product event to both analytics providers while keeping event
 * definitions centralized in this file.
 */
function trackEvent({
  name,
  properties = {},
}: {
  name: string;
  properties?: AnalyticsEventProperties;
}) {
  trackVercelEvent(name, properties);

  if (!getPostHogConfig()) {
    return;
  }

  posthog.capture(name, properties);
}

/**
 * Reuses the same primitive payload shape across player events because Vercel
 * Analytics custom event properties do not support nested objects.
 */
function getPlayerEventData({
  courseSlug,
  lessonKind,
  lessonSlug,
  stepCount,
}: PlayerEventInput): AnalyticsEventProperties {
  return { courseSlug, lessonKind, lessonSlug, stepCount };
}

/**
 * Sends flat analytics properties because Vercel Analytics does not support
 * nested event payloads, while each feedback kind needs a different slug set.
 */
function getFeedbackEventData(input: FeedbackInput): AnalyticsEventProperties {
  switch (input.kind) {
    case "course":
      return { courseSlug: input.courseSlug, feedback: input.feedback, kind: input.kind };
    case "chapter":
      return {
        chapterSlug: input.chapterSlug,
        courseSlug: input.courseSlug,
        feedback: input.feedback,
        kind: input.kind,
      };
    case "lesson":
      return {
        chapterSlug: input.chapterSlug,
        courseSlug: input.courseSlug,
        feedback: input.feedback,
        kind: input.kind,
        lessonSlug: input.lessonSlug,
      };
    case "courseSuggestions":
      return {
        feedback: input.feedback,
        kind: input.kind,
        locale: input.locale,
        prompt: input.prompt,
      };
    default:
      return throwUnexpectedFeedbackTarget(input);
  }
}

/**
 * Makes the feedback target switch exhaustive so adding a new target fails at
 * compile time unless the analytics payload shape is explicitly defined.
 */
function throwUnexpectedFeedbackTarget(input: never): never {
  throw new Error(`Unexpected feedback target: ${String(input)}`);
}

/**
 * Uses the same capped duration as persistence so browser analytics cannot
 * report idle tab time that the database correctly ignores.
 */
function getCompletionDurationSeconds({ startedAt }: { startedAt: number }) {
  return getCappedLessonDurationSeconds({ startedAt });
}
