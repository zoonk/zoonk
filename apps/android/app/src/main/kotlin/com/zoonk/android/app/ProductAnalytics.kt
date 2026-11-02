package com.zoonk.android.app

import android.content.Context
import com.posthog.PostHogInterface
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import com.zoonk.android.data.AnalyticsLearner
import com.zoonk.android.data.AnalyticsSdk
import java.util.Date

/** PostHog in release builds, the only ones that name a project. */
internal fun productAnalytics(context: Context): AnalyticsSdk? =
    BuildConfig.POSTHOG_PROJECT_TOKEN.takeIf { it.isNotEmpty() }?.let {
        PostHogAnalytics(context.applicationContext, it, BuildConfig.POSTHOG_HOST)
    }

/**
 * Sets PostHog up at the first share of each process, not at launch, so nothing of it runs or is
 * stored on the device before a learner shares usage data.
 */
private class PostHogAnalytics(
    private val context: Context,
    private val projectToken: String,
    private val host: String,
) : AnalyticsSdk {
    private var postHog: PostHogInterface? = null

    override fun share(learner: AnalyticsLearner) {
        val postHog = postHog ?: PostHogAndroid.with(context, config()).also { postHog = it }
        // Before optIn, which captures "Application Opened": that event must carry the properties and not
        // another learner's id. Identify is ignored while identified as someone else, such as a learner who
        // signed out while it was stopped.
        if (postHog.distinctId() != learner.userId) postHog.reset()
        learner.shared.forEach { (key, value) -> if (value == null) postHog.unregister(key) else postHog.register(key, value) }
        postHog.optIn()
        postHog.identify(learner.userId, learner.person)
    }

    override fun stop() {
        // By design, PostHog may still upload what it queued while the learner shared, and ask for flags, as
        // posthog-js does on main: https://github.com/PostHog/posthog-android/issues/919
        postHog?.optOut()
    }

    override fun reset() {
        postHog?.reset()
    }

    override fun capture(
        event: String,
        properties: Map<String, Any>,
        timestamp: Date?,
    ) {
        postHog?.capture(event, properties = properties, timestamp = timestamp)
    }

    private fun config() =
        PostHogAndroidConfig(projectToken, host).apply {
            // The summary decides each launch; a yes stored by an earlier one mustn't capture before it's read.
            optOut = true
            persistOptOut = false
            captureScreenViews = false
            // App links carry sign-in callbacks' codes.
            captureDeepLinks = false
            // Its reader thread follows logcat even without session replay.
            sessionReplayConfig.captureLogcat = false
            capturePushNotificationSubscriptions = false
            capturePushNotificationOpened = false
            preloadFeatureFlags = false
            sendFeatureFlagEvent = false
        }
}
