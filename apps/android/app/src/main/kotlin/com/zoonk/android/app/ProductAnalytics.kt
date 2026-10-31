package com.zoonk.android.app

import android.content.Context
import com.posthog.PostHogInterface
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import com.zoonk.android.data.AnalyticsLearner
import com.zoonk.android.data.AnalyticsSdk
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
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

    /** The learner's id and the random one their events before identify went under; empty while nobody shares. */
    @Volatile
    private var sendingAs = emptySet<String>()

    override fun share(learner: AnalyticsLearner) {
        val postHog = postHog ?: PostHogAndroid.with(context, config()).also { postHog = it }
        // Before optIn, which captures "Application Opened": that event must carry the properties and not
        // another learner's id. Identify is ignored while identified as someone else, such as a learner who
        // signed out while it was stopped.
        if (postHog.distinctId() != learner.userId) postHog.reset()
        sendingAs = setOf(learner.userId, postHog.distinctId(), postHog.getAnonymousId())
        learner.shared.forEach { (key, value) -> if (value == null) postHog.unregister(key) else postHog.register(key, value) }
        postHog.optIn()
        postHog.identify(learner.userId, learner.person)
    }

    override fun stop() {
        sendingAs = emptySet()
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
            // Opted out, PostHog still uploads its queue and asks for flags, so this answers what may not leave:
            // https://github.com/PostHog/posthog-android/issues/919
            httpClient =
                OkHttpClient
                    .Builder()
                    .addInterceptor { chain -> chain.request().let { if (it.mayLeaveAs(sendingAs)) chain.proceed(it) else withheld(it) } }
                    .build()
        }
}

private fun withheld(request: Request) =
    Response
        .Builder()
        .request(request)
        .protocol(Protocol.HTTP_1_1)
        .code(HTTP_FORBIDDEN)
        .message("Usage data isn't shared")
        .body("".toResponseBody())
        .build()

private const val HTTP_FORBIDDEN = 403

/**
 * Only event batches leave, as nothing else of PostHog's is used, and only with the sharing learner's
 * events: the queue keeps on disk what it couldn't send, such as events from offline, after another
 * learner opted out, and a flags request names whoever was current when it was made.
 */
internal fun Request.mayLeaveAs(ids: Set<String>): Boolean {
    if (ids.isEmpty() || !url.encodedPath.endsWith("/batch")) return false
    val sent = Buffer().also { body?.writeTo(it) }.readUtf8()
    return Json
        .parseToJsonElement(sent)
        .jsonObject["batch"]
        ?.jsonArray
        .orEmpty()
        .all { it.jsonObject["distinct_id"]?.jsonPrimitive?.content in ids }
}
