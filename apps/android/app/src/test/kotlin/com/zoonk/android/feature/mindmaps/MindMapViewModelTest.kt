package com.zoonk.android.feature.mindmaps

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterMindMapStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonElement
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class MindMapViewModelTest {
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val goalId = UUID.fromString(GOAL)
    private val chapterId = UUID.fromString(mapChapter(3))
    private val key = ChapterKey(goalId, chapterId)
    private val dispatcher = StandardTestDispatcher()
    private val api = FakeMindMapApi()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun aTapAsksForTheMapAndFollowsIt() =
        runTest(dispatcher) {
            val (maps) = setUp()

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(listOf(key), api.created)
            assertEquals(MindMapLocal(shown = MindMapShown.Generating), maps.requests.value[chapterId])
        }

    @Test
    fun aMapThatWasAlreadyDrawnIsReadAgainWhereItsShown() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.chapter[key].shown.collect {} }
            advanceUntilIdle()
            api.create = { generation("ready") }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(MindMapShown.Ready, maps.requests.value[chapterId]?.shown)
            assertEquals(2, api.chapters)
            shown.cancel()
        }

    @Test
    fun aCapSaysWhoseItIs() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.create = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, refusal("free", "day")) }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(
                MindMapLocal(shown = MindMapShown.Refused, limit = Limit.Reached(LimitTier.Free, LimitPeriod.Day)),
                maps.requests.value[chapterId],
            )
        }

    @Test
    fun aChapterNotFinishedHasNoMapToMake() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.create = { throw ApiException(ApiError.Unavailable, status = 422) }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(MindMapShown.Unavailable, maps.requests.value[chapterId]?.shown)
        }

    @Test
    fun anyOtherFailureSaysTheServerCouldntBeReached() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.create = { throw ApiException(ApiError.Network) }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(MindMapShown.Unreachable, maps.requests.value[chapterId]?.shown)
        }

    @Test
    fun followingStopsOnceTheMapIsDrawnAndReadsItAgain() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.list[goalId].shown.collect {} }
            advanceUntilIdle()
            api.statuses.addAll(listOf(ChapterMindMapStatus.Status.GENERATING, ChapterMindMapStatus.Status.READY))

            maps.follow(chapterId)
            advanceUntilIdle()

            assertEquals(2, api.asked)
            assertEquals(MindMapShown.Ready, maps.requests.value[chapterId]?.shown)
            assertEquals(2, api.lists)
            shown.cancel()
        }

    @Test
    fun threeMissesInARowStopFollowingAndTryAgainFollowsAgain() =
        runTest(dispatcher) {
            val (maps) = setUp()

            maps.follow(chapterId)

            assertEquals(3, api.asked)
            assertEquals(MindMapLocal(stuck = true), maps.requests.value[chapterId])

            maps.retry(chapterId)

            assertEquals(MindMapShown.Generating, maps.requests.value[chapterId]?.shown)
            assertTrue(api.created.isEmpty())
        }

    @Test
    fun aMapStillBeingDrawnIsFollowedUntilItFails() =
        runTest(dispatcher) {
            val (maps) = setUp()
            val generating = ChapterMindMapStatus.Status.GENERATING
            api.statuses.addAll(listOf(generating, generating, generating, ChapterMindMapStatus.Status.FAILED))

            maps.follow(chapterId)

            assertEquals(MindMapShown.Failed, maps.requests.value[chapterId]?.shown)
        }

    @Test
    fun aSavedPictureIsWrittenWhereTheLearnerChose() =
        runTest(dispatcher) {
            val (maps) = setUp()
            val file = ByteArrayOutputStream()

            maps.savePicture("https://api.zoonk.test/v1/files/images/a/b.webp") { file }
            advanceUntilIdle()

            assertEquals(listOf<Byte>(1, 2, 3), file.toByteArray().toList())
            assertEquals(PictureSave.Saved, maps.save.value)
        }

    @Test
    fun aPictureThatCouldntBeReadOrWrittenSaysSo() =
        runTest(dispatcher) {
            val (maps) = setUp()

            maps.savePicture("https://api.zoonk.test/v1/files/images/a/b.webp") { throw IOException("full") }
            advanceUntilIdle()

            assertEquals(PictureSave.Failed, maps.save.value)
        }

    private fun TestScope.setUp(): Pair<MindMapViewModel, MindMapStore> {
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + dispatcher))
        val store = MindMapStore(api, cache)
        return MindMapViewModel(store, ana, goalId, timeSource = testScheduler.timeSource, io = dispatcher) to store
    }

    private fun refusal(
        tier: String,
        period: String,
    ): JsonElement = ApiJson.parseToJsonElement("""{"limit":{"tier":"$tier","period":"$period"}}""")
}
