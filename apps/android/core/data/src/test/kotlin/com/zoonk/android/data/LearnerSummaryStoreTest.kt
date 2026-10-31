package com.zoonk.android.data

import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.time.Duration.Companion.minutes

@OptIn(ExperimentalCoroutinesApi::class)
class LearnerSummaryStoreTest {
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")

    @Test
    fun summaryConsentDecodesEveryDecision() {
        for (choice in listOf(true, false, null)) {
            val original = summary(readAt = 0, nextChangeAt = 0)
            val resolved = original.copy(analytics = original.analytics.copy(usageDataSharing = choice))
            val fixture = buildJsonObject { put("summary", ApiJson.encodeToJsonElement(resolved)) }
            val response = ApiJson.decodeFromJsonElement<LearnerSummaryResponse>(fixture)
            assertEquals(choice, response.summary.analytics.usageDataSharing)
        }
    }

    @Test
    fun theSummaryIsReadAgainAtItsNextChangeAndNotBefore() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val cache = AppCache(FakeSession(ana), scope)
            var reads = 0
            val store =
                LearnerSummaryStore(
                    api = {
                        reads++
                        summary(readAt = currentTime, nextChangeAt = currentTime + 30.minutes.inWholeMilliseconds)
                    },
                    cache = cache,
                    scope = scope,
                    now = { currentTime },
                )
            // While shown, each read re-arms the timer, so time is stepped rather than run to idle.
            val frame = launch { store.summary.shown.collect {} }
            runCurrent()
            assertEquals(1, reads)

            advanceTimeBy(29.minutes.inWholeMilliseconds)
            assertEquals(1, reads)
            advanceTimeBy(2.minutes.inWholeMilliseconds)
            assertEquals(2, reads)
            frame.cancel()
        }

    @Test
    fun aSummaryNoScreenShowsWaitsForItsNextLoad() =
        runTest {
            val scope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
            val cache = AppCache(FakeSession(ana), scope)
            var reads = 0
            val store =
                LearnerSummaryStore(
                    api = {
                        reads++
                        summary(readAt = currentTime, nextChangeAt = currentTime + 10.minutes.inWholeMilliseconds)
                    },
                    cache = cache,
                    scope = scope,
                    now = { currentTime },
                )
            store.summary.load()
            advanceTimeBy(11.minutes.inWholeMilliseconds)
            assertEquals(1, reads)
            store.summary.load()
            assertEquals(2, reads)
        }
}
