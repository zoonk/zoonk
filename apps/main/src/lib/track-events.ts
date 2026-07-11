import { track as trackVercelEvent } from "@vercel/analytics";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import posthog from "posthog-js";

type LessonProgressEventInput = {
  chapterPosition: number;
  courseSlug: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonSlug: string;
  stepCount: number;
};

type LessonCompletionEventInput = Omit<LessonProgressEventInput, "stepCount">;

type ChapterCompletionEventInput = {
  chapterPosition: number;
  chapterSlug: string;
  courseSlug: string;
};

type SubscriptionBillingPeriod = "monthly" | "yearly";

export type FeedbackValue = "upvote" | "downvote";

export type FeedbackTarget =
  | { courseSlug: string; kind: "course" }
  | { chapterSlug: string; courseSlug: string; kind: "chapter" }
  | { chapterSlug: string; courseSlug: string; kind: "lesson"; lessonSlug: string };

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
 * Counts learners who reached the first playable step after the player shell
 * mounted, which is the funnel denominator for later player events.
 */
export function trackLessonStarted(input: LessonProgressEventInput) {
  trackEvent({ name: "Lesson Started", properties: getLessonProgressEventData(input) });
}

/**
 * Counts learners who moved beyond the first step without depending on a
 * specific step renderer or interaction type.
 */
export function trackLessonSecondStep(input: LessonProgressEventInput) {
  trackEvent({ name: "Lesson Second Step", properties: getLessonProgressEventData(input) });
}

/**
 * Counts learners who reached the lesson completion event without sending
 * volatile step counts or client-side timing values.
 */
export function trackLessonCompleted(input: LessonCompletionEventInput) {
  trackEvent({ name: "Lesson Completed", properties: getLessonEventData(input) });
}

/**
 * Counts learners who reach the structural end of a chapter, including the
 * final chapter of a course where the visible milestone is the course
 * completion screen.
 */
export function trackChapterCompleted(input: ChapterCompletionEventInput) {
  trackEvent({ name: "Chapter Completed", properties: getChapterCompletionEventData(input) });
}

/**
 * Counts when the course goal form is visible, regardless of whether the
 * learner reached it from `/start/learn`, `/`, or another reusable placement.
 */
export function trackLearnForm() {
  trackEvent({ name: "Learn Form" });
}

/**
 * Counts when the shared start goal picker is visible, regardless of whether
 * learners reached it from `/start`, `/`, or another reusable placement.
 */
export function trackStartContent() {
  trackEvent({ name: "Start Goal" });
}

/**
 * Reports completed subscription checkouts after Stripe confirms the purchase
 * so analytics count real conversions instead of checkout button clicks.
 */
export function trackGoogleAdsSubscriptionConversion({ plan }: { plan: string }) {
  trackEvent({ name: "Subscription Conversion", properties: { plan } });

  if (!googleAdsSubscriptionConversionId) {
    return;
  }

  getGoogleTag()("event", "conversion", { send_to: googleAdsSubscriptionConversionId });
}

/**
 * Captures the plan a learner selected before they leave the app for Stripe
 * checkout, which is the subscription funnel denominator.
 */
export function trackSubscriptionCheckoutStarted({
  billingPeriod,
  plan,
}: {
  billingPeriod: SubscriptionBillingPeriod;
  plan: string;
}) {
  trackEvent({ name: "Subscription Checkout Started", properties: { billingPeriod, plan } });
}

/**
 * Counts learners who hit the reusable generation paywall instead of inferring
 * the subscription funnel from pageviews that look the same for subscribed and
 * gated learners.
 */
export function trackSubscriptionGateShown() {
  trackEvent({ name: "Subscription Gate Shown" });
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
  return globalThis;
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
  postHogOptions,
  properties = {},
}: {
  name: string;
  postHogOptions?: { send_instantly?: boolean; transport?: "sendBeacon" };
  properties?: AnalyticsEventProperties;
}) {
  trackVercelEvent(name, properties);

  if (!getPostHogConfig()) {
    return;
  }

  posthog.capture(name, properties, postHogOptions);
}

/**
 * Reuses the same primitive payload shape across lesson events because Vercel
 * Analytics custom event properties do not support nested objects.
 */
function getLessonProgressEventData(input: LessonProgressEventInput): AnalyticsEventProperties {
  return { ...getLessonEventData(input), stepCount: input.stepCount };
}

/**
 * Keeps every lesson funnel event filterable by course position while omitting
 * properties that are not stable enough for activation cohorts.
 */
function getLessonEventData({
  chapterPosition,
  courseSlug,
  lessonKind,
  lessonPosition,
  lessonSlug,
}: LessonCompletionEventInput): AnalyticsEventProperties {
  return { chapterPosition, courseSlug, lessonKind, lessonPosition, lessonSlug };
}

/**
 * Keeps chapter completion filters focused on the completed chapter instead of
 * the lesson that happened to trigger the structural milestone.
 */
function getChapterCompletionEventData({
  chapterPosition,
  chapterSlug,
  courseSlug,
}: ChapterCompletionEventInput): AnalyticsEventProperties {
  return { chapterPosition, chapterSlug, courseSlug };
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
