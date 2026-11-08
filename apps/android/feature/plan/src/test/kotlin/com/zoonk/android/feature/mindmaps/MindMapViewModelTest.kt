package com.zoonk.android.feature.mindmaps

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.ChapterMindMapStatus
import com.zoonk.api.models.GoalMindMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonElement
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
    private var current: AuthenticatedSession? = ana

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun aTapAsksForTheMapAndReadsItAgainWhereItsShown() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.chapter[key].shown.collect {} }
            advanceUntilIdle()
            api.chapter = { chapterMindMap("drawing") }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(listOf(key), api.created)
            assertNull(maps.requests.value[chapterId])
            assertEquals(MindMapShown.Drawing, store.chapterShown())
            shown.cancel()
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

            assertNull(maps.requests.value[chapterId])
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
                MindMapLocal(limit = Limit.Reached(LimitTier.Free, LimitPeriod.Day)),
                maps.requests.value[chapterId]?.copy(since = 0),
            )
        }

    @Test
    fun aRefusalOverTheLessonsItWouldWriteFirstIsWordedAsLessons() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.create = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 402, refusal("free", "month", "lessonStart")) }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(
                MindMapLocal(
                    limit = Limit.Reached(LimitTier.Free, LimitPeriod.Month),
                    subject = LimitSubject.Lessons,
                ),
                maps.requests.value[chapterId]?.copy(since = 0),
            )
        }

    @Test
    fun aPollStoppedWhileItReadsTheLockAgainLeavesNoLockAfterBuyingPlus() =
        runTest(dispatcher) {
            val (_, _, cache) = setUp()
            var hold = false
            val reading = CompletableDeferred<Unit>()
            val held =
                object : MindMapApi by api {
                    override suspend fun chapter(
                        session: AuthenticatedSession,
                        key: ChapterKey,
                    ): ChapterMindMap {
                        if (hold) {
                            reading.complete(Unit)
                            awaitCancellation()
                        }
                        return api.chapter(session, key)
                    }
                }
            val heldStore = MindMapStore(held, cache)
            val maps = MindMapViewModel(heldStore, ana, goalId, { current }, io = dispatcher)
            api.chapter = { chapterMindMap("drawing") }
            heldStore.chapter[key].load()
            api.statuses.add(ChapterMindMapStatus.Status.PLUS_REQUIRED)
            hold = true

            // Leaving the screen stops the poll while it reads the map again; the row still shows what the reads say.
            val follow = launch { maps.follow(chapterId, MindMapShown.Drawing) }
            reading.await()
            assertEquals(MindMapShown.Drawing, shownMindMap(heldStore.chapterShown(), maps.requests.value[chapterId]))
            follow.cancelAndJoin()

            hold = false
            api.chapter = { chapterMindMap("available") }
            cache.invalidate(setOf(DataDomain.UserSubscription))
            heldStore.chapter[key].load()

            assertEquals(MindMapShown.Available, shownMindMap(heldStore.chapterShown(), maps.requests.value[chapterId]))
        }

    @Test
    fun aPollAnsweredBeforeBuyingPlusCantLockTheMapReadAfterIt() =
        runTest(dispatcher) {
            val (_, _, cache) = setUp()
            val asked = CompletableDeferred<Unit>()
            val answer = CompletableDeferred<ChapterMindMapStatus.Status>()
            val slow =
                object : MindMapApi by api {
                    override suspend fun status(
                        session: AuthenticatedSession,
                        key: ChapterKey,
                    ): ChapterMindMapStatus.Status {
                        asked.complete(Unit)
                        return answer.await()
                    }
                }
            val slowStore = MindMapStore(slow, cache)
            val maps = MindMapViewModel(slowStore, ana, goalId, { current }, io = dispatcher)
            api.chapter = { chapterMindMap("drawing") }
            api.mindMaps = { goalMindMaps(listOf(mapJson(3, "Waves and sound", "drawing"))) }
            slowStore.list[goalId].load()
            slowStore.chapter[key].load()

            val follow = launch { maps.follow(chapterId, MindMapShown.Drawing) }
            asked.await()
            api.chapter = { chapterMindMap("ready") }
            api.mindMaps = { goalMindMaps(listOf(mapJson(3, "Waves and sound", "ready"))) }
            cache.invalidate(setOf(DataDomain.UserSubscription))
            slowStore.list[goalId].load()
            slowStore.chapter[key].load()
            api.chapter = { throw ApiException(ApiError.Network) }
            api.mindMaps = { throw ApiException(ApiError.Network) }
            answer.complete(ChapterMindMapStatus.Status.PLUS_REQUIRED)
            follow.join()

            assertEquals(MindMapShown.Ready, shownMindMap(slowStore.chapterShown(), maps.requests.value[chapterId]))
            assertEquals(
                MindMapShown.Ready,
                slowStore.list[goalId]
                    .state.value.value
                    ?.chapters
                    ?.single()
                    ?.status
                    ?.shown,
            )
        }

    @Test
    fun buyingPlusClearsARefusalEvenWhenTheMapStillReadsAvailable() =
        runTest(dispatcher) {
            val (maps, store, cache) = setUp()
            store.chapter[key].load()
            store.list[goalId].load()
            api.create = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, refusal("free", "day")) }

            maps.create(chapterId)
            advanceUntilIdle()
            assertEquals(MindMapShown.Refused, shownMindMap(store.chapterShown(), maps.requests.value[chapterId]))

            cache.invalidate(setOf(DataDomain.UserSubscription))
            store.chapter[key].load()
            store.list[goalId].load()

            assertEquals(MindMapShown.Available, shownMindMap(store.chapterShown(), maps.requests.value[chapterId]))
        }

    @Test
    fun aListClearsOnlyTheRefusalsOfTheChaptersItLists() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            store.chapter[key].load()
            store.list[goalId].load()
            api.create = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 403, refusal("free", "day")) }
            maps.create(chapterId)
            advanceUntilIdle()

            // A plan change dropped this chapter from the list while its own read stays.
            api.mindMaps = { goalMindMaps(listOf(mapJson(4, "Electricity", "drawing"))) }
            store.list[goalId].refresh()

            assertEquals(MindMapShown.Refused, shownMindMap(store.chapterShown(), maps.requests.value[chapterId]))
        }

    @Test
    fun aRefusalOverTheDaysAiSpendIsWordedAsHelpNotMaps() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.create = { throw ApiException(ApiError.Unavailable, "USAGE_LIMIT_REACHED", 429, refusal("plus", "day", "aiSpend")) }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(LimitSubject.Help, maps.requests.value[chapterId]?.subject)
        }

    @Test
    fun aPlusOnlyChapterShowsItsLockUntilBuyingPlusReadsItAgain() =
        runTest(dispatcher) {
            val (maps, store, cache) = setUp()
            val shown = launch { store.chapter[key].shown.collect {} }
            advanceUntilIdle()
            api.create = { throw ApiException(ApiError.Unavailable, "PLUS_REQUIRED", 402) }
            api.chapter = { chapterMindMap("plusRequired") }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(MindMapShown.PlusRequired, shownMindMap(store.chapterShown(), maps.requests.value[chapterId]))

            api.chapter = { chapterMindMap("available") }
            cache.invalidate(setOf(DataDomain.UserSubscription))
            advanceUntilIdle()

            assertEquals(MindMapShown.Available, shownMindMap(store.chapterShown(), maps.requests.value[chapterId]))
            shown.cancel()
        }

    @Test
    fun aPollThatEndsLockedLeavesTheRowToTheReads() =
        runTest(dispatcher) {
            val (maps, store, cache) = setUp()
            val shown = launch { store.chapter[key].shown.collect {} }
            advanceUntilIdle()
            api.chapter = { chapterMindMap("plusRequired") }
            api.statuses.add(ChapterMindMapStatus.Status.PLUS_REQUIRED)

            maps.follow(chapterId, MindMapShown.Drawing)
            advanceUntilIdle()
            api.chapter = { chapterMindMap("available") }
            cache.invalidate(setOf(DataDomain.UserSubscription))
            advanceUntilIdle()

            assertEquals(MindMapShown.Available, shownMindMap(store.chapterShown(), maps.requests.value[chapterId]))
            shown.cancel()
        }

    @Test
    fun aChapterWithoutAMapHasNoneToMake() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.chapter[key].shown.collect {} }
            advanceUntilIdle()
            api.create = { throw ApiException(ApiError.Unavailable, status = 422) }
            api.chapter = { chapterMindMap("unavailable") }

            maps.create(chapterId)
            advanceUntilIdle()

            assertNull(maps.requests.value[chapterId])
            assertEquals(MindMapShown.Unavailable, store.chapterShown())
            shown.cancel()
        }

    @Test
    fun anyOtherFailureSaysTheServerCouldntBeReached() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.create = { throw ApiException(ApiError.Network) }

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(MindMapShown.Unreachable, shownMindMap(MindMapShown.Available, maps.requests.value[chapterId]))
        }

    @Test
    fun followingStopsOnceTheMapIsDrawnAndReadsItAgain() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.list[goalId].shown.collect {} }
            advanceUntilIdle()
            api.mindMaps = { goalMindMaps(listOf(mapJson(3, "Waves and sound", "ready"))) }
            api.statuses.addAll(listOf(ChapterMindMapStatus.Status.DRAWING, ChapterMindMapStatus.Status.READY))

            maps.follow(chapterId, MindMapShown.Drawing)
            advanceUntilIdle()

            assertEquals(2, api.asked)
            assertNull(maps.requests.value[chapterId])
            assertEquals(2, api.lists)
            shown.cancel()
        }

    @Test
    fun threeMissesInARowSayTheServerIsOutOfReachAndTryAgainAsksAgain() =
        runTest(dispatcher) {
            val (maps) = setUp()

            maps.follow(chapterId, MindMapShown.WritingLessons)

            assertEquals(3, api.asked)
            assertEquals(MindMapLocal(unreachable = true), maps.requests.value[chapterId]?.copy(since = 0))

            maps.create(chapterId)
            advanceUntilIdle()

            assertEquals(listOf(key), api.created)
            assertNull(maps.requests.value[chapterId])
        }

    @Test
    fun aMapStillBeingDrawnIsFollowedUntilItFails() =
        runTest(dispatcher) {
            val (maps) = setUp()
            val drawing = ChapterMindMapStatus.Status.DRAWING
            api.statuses.addAll(listOf(drawing, drawing, drawing, ChapterMindMapStatus.Status.FAILED))

            maps.follow(chapterId, MindMapShown.Drawing)

            assertEquals(4, api.asked)
            assertNull(maps.requests.value[chapterId])
        }

    @Test
    fun lessonsBeingWrittenAreAskedAboutLessOftenThanADrawing() =
        runTest(dispatcher) {
            val (maps) = setUp()
            api.statuses.addAll(
                listOf(
                    ChapterMindMapStatus.Status.WRITING_LESSONS,
                    ChapterMindMapStatus.Status.DRAWING,
                    ChapterMindMapStatus.Status.FAILED,
                ),
            )

            maps.follow(chapterId, MindMapShown.WritingLessons)

            assertEquals(34_000L, currentTime)
            assertNull(maps.requests.value[chapterId])
        }

    @Test
    fun aMapBeingDrawnShowsAsDrawingWhereItWasRead() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.list[goalId].shown.collect {} }
            advanceUntilIdle()
            api.mindMaps = { goalMindMaps(listOf(mapJson(3, "Waves and sound", "drawing"))) }

            maps.create(chapterId)
            advanceUntilIdle()

            val listed =
                store.list[goalId]
                    .state.value.value
                    ?.chapters
                    ?.first { it.chapterId == chapterId }
            assertEquals(GoalMindMap.Status.DRAWING, listed?.status)
            assertEquals(2, api.lists)
            shown.cancel()
        }

    @Test
    fun aReadThatDoesntCatchUpAfterTheMapIsDrawnKeepsFollowing() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.list[goalId].shown.collect {} }
            advanceUntilIdle()
            var reads = 0
            api.mindMaps = {
                reads++
                if (reads == 1) throw ApiException(ApiError.Network)
                goalMindMaps(listOf(mapJson(3, "Waves and sound", "ready")))
            }
            api.statuses.addAll(List(3) { ChapterMindMapStatus.Status.READY })

            maps.follow(chapterId, MindMapShown.Drawing)
            advanceUntilIdle()

            assertEquals(2, api.asked)
            assertEquals(
                GoalMindMap.Status.READY,
                store.list[goalId]
                    .state.value.value
                    ?.chapters
                    ?.single()
                    ?.status,
            )
            shown.cancel()
        }

    @Test
    fun readsThatNeverCatchUpGiveUpWithTryAgain() =
        runTest(dispatcher) {
            val (maps, store) = setUp()
            val shown = launch { store.list[goalId].shown.collect {} }
            advanceUntilIdle()
            api.mindMaps = { throw ApiException(ApiError.Network) }
            api.statuses.addAll(List(3) { ChapterMindMapStatus.Status.READY })

            maps.follow(chapterId, MindMapShown.Drawing)

            assertEquals(MindMapLocal(unreachable = true), maps.requests.value[chapterId]?.copy(since = 0))
            shown.cancel()
        }

    @Test
    fun aPictureThatArrivesAfterItsSessionEndedIsNeitherWrittenNorReported() =
        runTest(dispatcher) {
            val (maps) = setUp()
            val file = ByteArrayOutputStream()
            api.picture = {
                current = null
                byteArrayOf(1, 2, 3)
            }

            maps.savePicture("https://api.zoonk.test/v1/files/images/a/b.webp") { file }
            advanceUntilIdle()

            assertEquals(0, file.size())
            assertNull(maps.save.value)
        }

    @Test
    fun aDestinationTheAppCantWriteIsAFailedSave() =
        runTest(dispatcher) {
            val (maps) = setUp()

            maps.savePicture("https://api.zoonk.test/v1/files/images/a/b.webp") { throw SecurityException("revoked") }
            advanceUntilIdle()

            assertEquals(PictureSave.Failed, maps.save.value)
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

    private fun TestScope.setUp(): Triple<MindMapViewModel, MindMapStore, AppCache> {
        val cache = AppCache(FakeSession(ana), CoroutineScope(SupervisorJob() + dispatcher))
        val store = MindMapStore(api, cache)
        return Triple(MindMapViewModel(store, ana, goalId, { current }, io = dispatcher), store, cache)
    }

    private fun MindMapStore.chapterShown() =
        chapter[key]
            .state.value.value!!
            .status.shown

    private fun refusal(
        tier: String,
        period: String,
        resource: String = "mindMap",
    ): JsonElement = ApiJson.parseToJsonElement("""{"limit":{"tier":"$tier","period":"$period","resource":"$resource"}}""")
}
