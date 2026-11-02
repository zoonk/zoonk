package com.zoonk.android.data

import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Date
import java.util.UUID

private class RecordingSdk : AnalyticsSdk {
    val calls = mutableListOf<Any>()

    override fun share(learner: AnalyticsLearner) {
        calls += learner
    }

    override fun stop() {
        calls += "stop"
    }

    override fun reset() {
        calls += "reset"
    }

    override fun capture(
        event: String,
        properties: Map<String, Any>,
        timestamp: Date?,
    ) {
        calls += timestamp?.let { "$event at ${it.time}" } ?: event
    }
}

private class GatedProfileApi : LearningProfileApi {
    val saved = CompletableDeferred<Unit>()
    var current: LearningProfile =
        ApiJson.decodeFromString(
            """{"activeGoalId":null,"availableGlasses":["round"],"buddy":{"glasses":"round","kind":"zu","name":null,"picked":false},"dailyLimitMinutes":45,"dailyTimes":[5,10,15],"shareUsageData":true,"soundsEnabled":true}""",
        )

    override suspend fun profile(session: AuthenticatedSession) = current

    override suspend fun update(
        session: AuthenticatedSession,
        change: JsonObject,
    ): LearningProfile {
        saved.await()
        return current
    }
}

private fun learner(
    id: String = ANA,
    sharing: Boolean? = true,
): LearnerSummary =
    summary(readAt = 0, nextChangeAt = 0).let {
        it.copy(
            analytics = it.analytics.copy(goal = null, plan = "plus", usageDataSharing = sharing, username = "ana"),
            identity = it.identity.copy(isAnonymous = false, userId = UUID.fromString(id)),
        )
    }

private fun shared(id: String = ANA) =
    AnalyticsLearner(
        userId = id,
        person = mapOf("analyticsDisabled" to false, "plan" to "plus", "userId" to id, "username" to "ana"),
        shared = mapOf("goal_kind" to null, "is_guest" to false, "locale" to "pt", "plan_phase" to null, "platform" to "android"),
    )

@OptIn(ExperimentalCoroutinesApi::class)
class AnalyticsTest {
    private val sdk = RecordingSdk()
    private val summary = MutableStateFlow<LoadState<LearnerSummary>>(LoadState.Idle)
    private val profile = MutableStateFlow<LoadState<LearningProfile>>(LoadState.Idle)
    private val language = MutableStateFlow("pt")
    private val session =
        MutableStateFlow<SessionState>(
            SessionState.SignedIn(AuthenticatedSession(ANA, "token-a", "local-a"), account(ANA), isGuest = false),
        )

    private fun signOut() {
        session.value = SessionState.SignedOut()
        summary.value = LoadState.Idle
    }

    private fun TestScope.analytics(profile: StateFlow<LoadState<LearningProfile>> = this@AnalyticsTest.profile) =
        Analytics(
            sdk,
            session,
            summary,
            profile,
            language,
            CoroutineScope(
                SupervisorJob() + UnconfinedTestDispatcher(testScheduler),
            ),
            now = {
                clock
            },
        )

    private var clock = 1_000L

    @Test
    fun nothingStartsUntilALearnerSharingUsageDataIsLoaded() =
        runTest {
            analytics()

            summary.value = LoadState.Loading
            summary.value = LoadState.Loaded(learner(sharing = null))
            summary.value = LoadState.Loaded(learner(sharing = false))

            assertEquals(emptyList<Any>(), sdk.calls)

            summary.value = LoadState.Loaded(learner(sharing = true))

            assertEquals(listOf<Any>(shared()), sdk.calls)
        }

    @Test
    fun eventsAreSentOnlyWhileTheLearnerShares() =
        runTest {
            val analytics = analytics()

            analytics.track(AnalyticsEvent.TodayViewed)
            summary.value = LoadState.Loaded(learner(sharing = null))
            analytics.track(AnalyticsEvent.TodayViewed)
            summary.value = LoadState.Loaded(learner())
            analytics.track(AnalyticsEvent.LogbookViewed)
            summary.value = LoadState.Loaded(learner(sharing = false))
            analytics.track(AnalyticsEvent.TodayViewed)
            summary.value = LoadState.Loaded(learner())
            signOut()
            analytics.track(AnalyticsEvent.TodayViewed)

            assertEquals(listOf<Any>(shared(), "Logbook Viewed", "stop", shared(), "stop", "reset"), sdk.calls)
        }

    @Test
    fun aViewBeforeTheSummaryIsSentOnceItSaysToShare() =
        runTest {
            val analytics = analytics()

            analytics.track(AnalyticsEvent.TodayViewed)
            clock = 5_000L
            summary.value = LoadState.Loaded(learner())

            assertEquals(listOf<Any>(shared(), "Today Viewed at 1000"), sdk.calls)
        }

    @Test
    fun aViewBeforeTheSummaryIsDroppedWhenItSaysNot() =
        runTest {
            val analytics = analytics()

            analytics.track(AnalyticsEvent.TodayViewed)
            summary.value = LoadState.Loaded(learner(sharing = null))
            summary.value = LoadState.Loaded(learner())

            assertEquals(listOf<Any>(shared()), sdk.calls)
        }

    @Test
    fun aVisitorsViewsGoToTheLearnerTheyBecome() =
        runTest {
            session.value = SessionState.SignedOut()
            val analytics = analytics()

            analytics.track(AnalyticsEvent.HomeViewed)
            session.value = SessionState.SignedIn(AuthenticatedSession(ANA, "token-a", "local-a"), account(ANA), isGuest = false)
            summary.value = LoadState.Loaded(learner())

            assertEquals(listOf<Any>(shared(), "Home Viewed at 1000"), sdk.calls)
        }

    @Test
    fun aLearnersWaitingViewsEndWithTheirSession() =
        runTest {
            val analytics = analytics()

            analytics.track(AnalyticsEvent.TodayViewed)
            signOut()
            session.value = SessionState.SignedIn(AuthenticatedSession(BIA, "token-b", "local-b"), account(BIA), isGuest = false)
            summary.value = LoadState.Loaded(learner(id = BIA))

            assertEquals(listOf<Any>(shared(id = BIA)), sdk.calls)
        }

    @Test
    fun signingOutStopsBeforeForgettingTheLearner() =
        runTest {
            analytics()
            summary.value = LoadState.Loaded(learner())

            signOut()

            assertEquals(listOf<Any>(shared(), "stop", "reset"), sdk.calls)
        }

    @Test
    fun anotherLearnerStartsUnlinkedFromTheLastOne() =
        runTest {
            analytics()
            summary.value = LoadState.Loaded(learner())

            summary.value = LoadState.Loaded(learner(id = BIA))

            assertEquals(listOf<Any>(shared(), "reset", shared(id = BIA)), sdk.calls)
        }

    @Test
    fun aLearnerWhoStoppedSharingIsStillForgottenOnSignOut() =
        runTest {
            analytics()
            summary.value = LoadState.Loaded(learner())
            summary.value = LoadState.Loaded(learner(sharing = false))

            signOut()

            assertEquals(listOf<Any>(shared(), "stop", "reset"), sdk.calls)
        }

    @Test
    fun turningTheSwitchOffStopsBeforeTheChangeIsSaved() =
        runTest {
            val api = GatedProfileApi()
            val store =
                LearningProfileStore(
                    api,
                    AppCache(
                        FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")),
                        CoroutineScope(SupervisorJob() + UnconfinedTestDispatcher(testScheduler)),
                    ),
                )
            store.profile.load()
            analytics(store.profile.state)
            summary.value = LoadState.Loaded(learner())

            val saved = async { store.setShareUsageData(false) }
            runCurrent()

            assertEquals(listOf<Any>(shared(), "stop"), sdk.calls)

            api.current = api.current.copy(shareUsageData = false)
            api.saved.complete(Unit)
            saved.await()
            summary.value = LoadState.Loaded(learner(sharing = false))
            advanceUntilIdle()

            assertEquals(listOf<Any>(shared(), "stop"), sdk.calls)
        }
}
