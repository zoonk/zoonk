package com.zoonk.android.feature.plan

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.ApiJson
import com.zoonk.api.models.SkillOutline
import com.zoonk.api.models.SkillOutlineChapter
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class)
class FarTopicViewModelTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString(GOAL)
    private val dispatcher = StandardTestDispatcher()
    private val api = FakePlanApi()
    private val flask = topic(FAR_SKILL, "Flask")
    private val django = topic("6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1e02", "Django")
    private val chapters = listOf(SkillOutlineChapter(UUID.fromString(CHAPTER_LATER), "Routes and views"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun openingATopicReadsItsLessonPlanAndWritesNothing() =
        runTest(dispatcher) {
            val (topics) = setUp()

            topics.open(flask)
            advanceUntilIdle()

            assertEquals(FarTopicSheetState(flask, FarTopicShown.Available), topics.sheet.value)
            assertEquals(1, api.outlineReads)
            assertEquals(emptyList<UUID>(), api.outlineWrites)
        }

    @Test
    fun seeTheLessonsWritesThemFollowsThemAndThePageReadsAgainOnceClosed() =
        runTest(dispatcher) {
            val (topics, store) = setUp()
            val page = launch { store.plan[goalId].shown.collect {} }
            advanceUntilIdle()
            topics.open(flask)
            advanceUntilIdle()

            topics.request()
            advanceUntilIdle()
            assertEquals(FarTopicShown.Writing, topics.sheet.value?.shown)
            assertEquals(listOf(flask.skillId), api.outlineWrites)

            api.outline = { SkillOutline(emptyList(), SkillOutline.Status.WRITING) }
            val following = launch { topics.follow(flask.skillId) }
            advanceTimeBy(5.seconds)
            api.outline = { SkillOutline(chapters, SkillOutline.Status.READY) }
            advanceUntilIdle()
            following.join()

            assertEquals(FarTopicShown.Ready(chapters), topics.sheet.value?.shown)
            assertEquals(1, api.plans)

            topics.close()
            advanceUntilIdle()

            assertNull(topics.sheet.value)
            assertEquals(2, api.plans)
            page.cancel()
        }

    @Test
    fun closingATopicWhoseLessonsDidntLandLeavesThePageAlone() =
        runTest(dispatcher) {
            val (topics, store) = setUp()
            val page = launch { store.plan[goalId].shown.collect {} }
            advanceUntilIdle()

            topics.open(flask)
            advanceUntilIdle()
            topics.close()
            advanceUntilIdle()

            assertEquals(1, api.plans)
            page.cancel()
        }

    @Test
    fun aCapSaysWhoseItIs() =
        runTest(dispatcher) {
            val (topics) = setUp()
            api.writeOutline = {
                throw ApiException(
                    ApiError.Unavailable,
                    "USAGE_LIMIT_REACHED",
                    402,
                    ApiJson.parseToJsonElement("""{"limit":{"period":"day","tier":"free"}}"""),
                )
            }

            topics.open(flask)
            topics.request()
            advanceUntilIdle()

            assertEquals(FarTopicShown.Refused(Limit.Reached(LimitTier.Free, LimitPeriod.Day)), topics.sheet.value?.shown)
        }

    @Test
    fun aTopicWithNothingLeftToWriteSaysSo() =
        runTest(dispatcher) {
            val (topics) = setUp()
            api.writeOutline = { throw ApiException(ApiError.Unavailable, status = 422) }

            topics.open(flask)
            topics.request()
            advanceUntilIdle()

            assertEquals(FarTopicShown.Unavailable, topics.sheet.value?.shown)
        }

    @Test
    fun aFollowThatKeepsMissingStopsAndTryAgainFollowsWithoutWritingAgain() =
        runTest(dispatcher) {
            val (topics) = setUp()
            topics.open(flask)
            topics.request()
            advanceUntilIdle()
            api.outline = { throw ApiException(ApiError.Network) }

            topics.follow(flask.skillId)
            assertEquals(FarTopicShown.Unreachable(stuck = true), topics.sheet.value?.shown)

            topics.retry()
            advanceUntilIdle()

            assertEquals(FarTopicShown.Writing, topics.sheet.value?.shown)
            assertEquals(listOf(flask.skillId), api.outlineWrites)
        }

    @Test
    fun anAnswerForAClosedTopicDoesntShowOnTheNextOne() =
        runTest(dispatcher) {
            val (topics) = setUp()
            val gate = CompletableDeferred<Unit>()
            api.outlineGate = gate
            topics.open(flask)
            advanceUntilIdle()
            topics.request()
            advanceUntilIdle()

            topics.close()
            topics.open(django)
            advanceUntilIdle()
            gate.complete(Unit)
            advanceUntilIdle()

            assertEquals(FarTopicSheetState(django, FarTopicShown.Available), topics.sheet.value)
        }

    private fun TestScope.setUp(): Pair<FarTopicViewModel, PlanStore> {
        val store = PlanStore(api, AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))))
        return FarTopicViewModel(store, goalId, timeSource = testScheduler.timeSource) to store
    }

    private fun topic(
        skillId: String,
        title: String,
    ) = FarTopic(UUID.fromString(skillId), title, lessons = 6, nextDate = kotlinx.datetime.LocalDate(2026, 12, 21))
}
