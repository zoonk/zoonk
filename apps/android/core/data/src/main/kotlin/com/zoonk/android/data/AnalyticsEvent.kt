package com.zoonk.android.data

import androidx.activity.compose.LocalActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.staticCompositionLocalOf
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.subscription.BillingPeriod
import com.zoonk.api.models.MemoryInsight
import com.zoonk.api.models.Milestone
import java.util.UUID

/**
 * The events the app sends itself, with main's names and properties (`packages/core/src/analytics/events.ts`).
 * The server sends learners' outcomes from their requests, so the app never sends those.
 */
sealed class AnalyticsEvent(
    val name: String,
    val properties: Map<String, Any> = emptyMap(),
) {
    data class PublicPageViewed(
        val contentId: String,
        val page: PublicPage,
    ) : AnalyticsEvent("Public Page Viewed", mapOf("content_id" to contentId, "page" to page.value))

    data class PlanLinkOpened(
        val planId: String,
    ) : AnalyticsEvent("Plan Link Opened", mapOf("plan_id" to planId))

    data class GoalTyped(
        val hasAttachment: Boolean,
        val attemptId: String = UUID.randomUUID().toString(),
        val submittedAt: Long = System.currentTimeMillis(),
    ) : AnalyticsEvent("Goal Typed", mapOf("has_attachment" to hasAttachment, "attempt_id" to attemptId, "submitted_at" to submittedAt))

    data class OnboardingProgressed(
        val stage: String,
        val goalId: String? = null,
        val onboardingId: String? = null,
        val attemptId: String? = null,
        val question: String? = null,
        val deckId: String? = null,
        val lessonId: String? = null,
        val at: Long = System.currentTimeMillis(),
    ) : AnalyticsEvent(
            "Onboarding Progressed",
            listOfNotNull(
                "stage" to stage,
                "at" to at,
                goalId?.let { "goal_id" to it },
                onboardingId?.let { "onboarding_id" to it },
                attemptId?.let { "attempt_id" to it },
                question?.let { "question" to it },
                deckId?.let { "deck_id" to it },
                lessonId?.let { "lesson_id" to it },
            ).toMap(),
        )

    data class GenerationWaited(
        val surface: String,
        val contentKind: String,
        val startedAt: Long,
        val endedAt: Long,
        val goalId: String? = null,
        val onboardingId: String? = null,
        val attemptId: String? = null,
    ) : AnalyticsEvent(
            "Generation Waited",
            listOfNotNull(
                "surface" to surface,
                "content_kind" to contentKind,
                "started_at" to startedAt,
                "ended_at" to endedAt,
                "milliseconds" to (endedAt - startedAt).coerceAtLeast(0),
                goalId?.let { "goal_id" to it },
                onboardingId?.let { "onboarding_id" to it },
                attemptId?.let { "attempt_id" to it },
            ).toMap(),
        )

    data class HookAnswered(
        val lessonId: String,
    ) : AnalyticsEvent("Hook Answered", mapOf("lesson_id" to lessonId))

    data class ActivityUsed(
        val lessonId: String,
        val template: String,
    ) : AnalyticsEvent("Activity Used", mapOf("lesson_id" to lessonId, "template" to template))

    /** [screen] counts from 1. */
    data class ActivityAbandoned(
        val lessonId: String,
        val screen: Int,
        val stepKind: StepKind?,
        val wrongInARow: Int,
    ) : AnalyticsEvent(
            "Activity Abandoned",
            mapOf(
                "lesson_id" to lessonId,
                "screen" to screen,
                // The contract's step kinds are these names in lower camel case.
                "step_kind" to (stepKind?.name?.replaceFirstChar(Char::lowercaseChar) ?: "unknown"),
                "wrong_in_a_row" to wrongInARow,
            ),
        )

    data object HomeViewed : AnalyticsEvent("Home Viewed")

    data object TodayViewed : AnalyticsEvent("Today Viewed")

    data object LogbookViewed : AnalyticsEvent("Logbook Viewed")

    /** [insightId] tells insights apart; main sends only their kind. */
    data class InsightShown(
        val insightId: UUID,
        val kind: MemoryInsight.Kind,
    ) : AnalyticsEvent(
            "Insight Shown",
            mapOf(
                "insight" to
                    when (kind) {
                        MemoryInsight.Kind.PLAN_CHANGE -> "plan_change"
                        MemoryInsight.Kind.SCHEDULE_IDEA -> "schedule"
                        MemoryInsight.Kind.TIP -> "tip"
                    },
            ),
        )

    /** A badge gets no ceremony, so it's never sent. */
    data class CeremonyShown(
        val kind: Milestone.Kind,
    ) : AnalyticsEvent(
            "Ceremony Shown",
            mapOf(
                "ceremony" to
                    when (kind) {
                        Milestone.Kind.BELT -> "belt"
                        Milestone.Kind.BUDDY_STAGE -> "buddy_stage"
                        Milestone.Kind.GLASSES -> "glasses"
                        Milestone.Kind.BADGE -> "badge"
                    },
            ),
        )

    /**
     * Once per connection, however it ended. A reply gap with nothing to measure is left out where main
     * sends it null: PostHog reads a missing property as null, and its capture takes no null values.
     */
    data class CallEnded(
        val reason: String,
        val conversationKind: String,
        val talkSeconds: Long,
        val durationSeconds: Long,
        val learnerTurns: Int,
        val unansweredTurns: Int,
        val replyGapMedianMs: Long?,
        val replyGapMaxMs: Long?,
        val slowReplies: Int,
        val delegations: Int,
    ) : AnalyticsEvent(
            "Call Ended",
            listOfNotNull(
                "reason" to reason,
                "conversation_kind" to conversationKind,
                "talk_seconds" to talkSeconds,
                "duration_seconds" to durationSeconds,
                "learner_turns" to learnerTurns,
                "unanswered_turns" to unansweredTurns,
                replyGapMedianMs?.let { "reply_gap_median_ms" to it },
                replyGapMaxMs?.let { "reply_gap_max_ms" to it },
                "slow_replies" to slowReplies,
                "delegations" to delegations,
            ).toMap(),
        )

    data object SubscriptionGateShown : AnalyticsEvent("Subscription Gate Shown")

    data class SubscriptionCheckoutStarted(
        val period: BillingPeriod,
    ) : AnalyticsEvent(
            "Subscription Checkout Started",
            mapOf(
                "billingPeriod" to
                    when (period) {
                        BillingPeriod.Monthly -> "monthly"
                        BillingPeriod.Yearly -> "yearly"
                    },
                "plan" to "plus",
            ),
        )

    data class WarmUpShown(
        val surface: WarmUpSurface,
        val cardCount: Int,
        val deckId: String? = null,
        val goalId: String? = null,
        val at: Long = System.currentTimeMillis(),
    ) : AnalyticsEvent(
            "Warm-Up Shown",
            listOfNotNull(
                "surface" to surface.value,
                "card_count" to cardCount,
                "at" to at,
                deckId?.let { "deck_id" to it },
                goalId?.let { "goal_id" to it },
            ).toMap(),
        )

    /** [position] counts from 1 in the deck. */
    data class WarmUpAnswered(
        val surface: WarmUpSurface,
        val cardId: String,
        val position: Int,
        val correct: Boolean,
    ) : AnalyticsEvent(
            "Warm-Up Answered",
            mapOf("surface" to surface.value, "card_id" to cardId, "position" to position, "correct" to correct),
        )

    enum class WarmUpSurface(
        val value: String,
    ) {
        PlanWait("planWait"),
        PlacementWait("placementWait"),
        LessonWait("lessonWait"),
    }

    enum class PublicPage(
        val value: String,
    ) {
        Course("course"),
        Chapter("chapter"),
        Lesson("lesson"),
    }
}

fun interface EventTracker {
    fun track(event: AnalyticsEvent)
}

/** The shell provides the container's `analytics`; previews and tests send nowhere unless they provide one. */
val LocalEventTracker = staticCompositionLocalOf { EventTracker {} }

private val onScreen = mutableSetOf<Pair<String, AnalyticsEvent>>()

/**
 * Sends [event] each time the caller comes on screen, as main does when a page renders: not when it
 * recomposes, and not when a rotation recreates the activity. Wrap it in `key` to send again for a new
 * thing in the same place.
 */
@Composable
fun TrackShown(event: AnalyticsEvent) {
    val tracker = LocalEventTracker.current
    val activity = LocalActivity.current
    val appearance = rememberSaveable { UUID.randomUUID().toString() } to event
    DisposableEffect(appearance) {
        if (onScreen.add(appearance)) tracker.track(event)
        onDispose { if (activity?.isChangingConfigurations != true) onScreen.remove(appearance) }
    }
}
