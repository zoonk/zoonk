package com.zoonk.android.data

import android.content.ComponentCallbacks
import android.content.Context
import android.content.res.Configuration
import androidx.core.os.ConfigurationCompat
import com.zoonk.android.feature.catalog.catalogLanguage
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.util.Date
import java.util.Locale

/** PostHog as [Analytics] drives it. */
interface AnalyticsSdk {
    /** Called again whenever anything in [learner] changes. */
    fun share(learner: AnalyticsLearner)

    fun stop()

    fun reset()

    /** [timestamp] null is now. */
    fun capture(
        event: String,
        properties: Map<String, Any>,
        timestamp: Date?,
    )
}

/** [person] holds main's person properties and [shared] what every event carries; a null shared property clears it. */
data class AnalyticsLearner(
    val userId: String,
    val person: Map<String, Any>,
    val shared: Map<String, Any?>,
)

/**
 * PostHog runs only while a learner (signed in or guest) is loaded and their summary says usage data
 * may be shared. The profile shows the learner turning it off at once, so that stops it before the
 * summary is read again. Events from before a summary answers wait for it with their own time, as
 * main's wait for the page's decision: a visitor's go to the learner they become, and a learner's end
 * with their session.
 */
class Analytics(
    private val sdk: AnalyticsSdk?,
    session: StateFlow<SessionState>,
    summary: StateFlow<LoadState<LearnerSummary>>,
    profile: StateFlow<LoadState<LearningProfile>>,
    language: Flow<String>,
    scope: CoroutineScope,
    private val now: () -> Long = System::currentTimeMillis,
) : EventTracker {
    private var consent: Consent = Consent.Undecided(session = null)
    private val waiting = mutableListOf<Pair<AnalyticsEvent, Date>>()

    private val viewer get() = (consent as? Consent.Decided)?.viewer

    init {
        if (sdk != null) {
            scope.launch {
                combine(session, summary, profile, language) { session, summary, profile, language ->
                    summary.value?.let { Consent.Decided(viewer(it, profile.value, language)) }
                        ?: Consent.Undecided((session as? SessionState.SignedIn)?.session?.localId)
                }.distinctUntilChanged()
                    .collect { follow(sdk, it) }
            }
        }
    }

    override fun track(event: AnalyticsEvent) {
        val sdk = sdk ?: return
        when {
            viewer?.sharing == true -> sdk.capture(event.name, event.properties, timestamp = null)
            consent is Consent.Undecided && waiting.size < WAITING_LIMIT -> waiting += event to Date(now())
        }
    }

    private fun follow(
        sdk: AnalyticsSdk,
        next: Consent,
    ) {
        val previousConsent = consent
        val previous = viewer
        consent = next
        val current = viewer
        if (previous?.sharing == true && current?.sharing != true) sdk.stop()
        if (previous != null && previous.learner.userId != current?.learner?.userId) sdk.reset()
        if (current?.sharing == true) sdk.share(current.learner)
        when {
            current?.sharing == true -> waiting.forEach { (event, at) -> sdk.capture(event.name, event.properties, at) }
            current == null && previousConsent == Consent.Undecided(session = null) -> return
        }
        waiting.clear()
    }
}

private sealed interface Consent {
    /** No summary yet: [session] is the learner's whose summary is on its way, null for a visitor. */
    data class Undecided(
        val session: String?,
    ) : Consent

    data class Decided(
        val viewer: Viewer,
    ) : Consent
}

private const val WAITING_LIMIT = 50

/** The language the app shows, again each time the learner or the system changes it. */
fun Context.shownLanguage(): Flow<String> =
    callbackFlow {
        val callbacks =
            object : ComponentCallbacks {
                override fun onConfigurationChanged(newConfig: Configuration) {
                    trySend(newConfig.shownLanguage())
                }

                @Deprecated("Superseded by onTrimMemory, which this doesn't need.")
                override fun onLowMemory() = Unit
            }
        trySend(resources.configuration.shownLanguage())
        registerComponentCallbacks(callbacks)
        awaitClose { unregisterComponentCallbacks(callbacks) }
    }

private fun Configuration.shownLanguage() = catalogLanguage(ConfigurationCompat.getLocales(this)[0] ?: Locale.getDefault())

private data class Viewer(
    val learner: AnalyticsLearner,
    val sharing: Boolean,
)

private fun viewer(
    summary: LearnerSummary,
    profile: LearningProfile?,
    language: String,
): Viewer {
    val analytics = summary.analytics
    val userId = summary.identity.userId.toString()
    return Viewer(
        learner =
            AnalyticsLearner(
                userId = userId,
                person =
                    buildMap {
                        put("analyticsDisabled", analytics.disabled)
                        put("plan", analytics.plan)
                        put("userId", userId)
                        analytics.username?.let { put("username", it) }
                    },
                shared =
                    mapOf(
                        "goal_kind" to analytics.goal?.kind?.value,
                        "is_guest" to summary.identity.isAnonymous,
                        "locale" to language,
                        "plan_phase" to analytics.goal?.phase,
                        "platform" to "android",
                    ),
            ),
        sharing = analytics.usageDataSharing == true && profile?.shareUsageData != false,
    )
}
