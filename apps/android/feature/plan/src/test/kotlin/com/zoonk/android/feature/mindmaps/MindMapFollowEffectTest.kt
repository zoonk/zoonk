package com.zoonk.android.feature.mindmaps

import androidx.compose.runtime.AbstractApplier
import androidx.compose.runtime.BroadcastFrameClock
import androidx.compose.runtime.Composition
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Recomposer
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.ChapterMindMapStatus
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.currentTime
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/**
 * A row through the real follow effect, which stops a poll only on the frame after the row changes:
 * answers and reads can land in between, and buying Plus must still show the fresh reads.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class MindMapFollowEffectTest {
    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val key = ChapterKey(UUID.fromString(GOAL), UUID.fromString(mapChapter(3)))
    private val fake = FakeMindMapApi()

    /** Set, the chapter's read waits forever once asked: a slow read the effect cancels. */
    private var holdChapter: CompletableDeferred<Unit>? = null

    /** Set, the status answers only once it completes. */
    private var answer: CompletableDeferred<ChapterMindMapStatus.Status>? = null

    private val api =
        object : MindMapApi by fake {
            override suspend fun chapter(
                session: AuthenticatedSession,
                key: ChapterKey,
            ): ChapterMindMap {
                holdChapter?.let {
                    it.complete(Unit)
                    awaitCancellation()
                }
                return fake.chapter(session, key)
            }

            override suspend fun status(
                session: AuthenticatedSession,
                key: ChapterKey,
            ): ChapterMindMapStatus.Status = answer?.await() ?: fake.status(session, key)
        }

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun aPollAnsweredBeforeBuyingPlusCantLockTheReadyRowItsEffectIsLeaving() =
        runTest(dispatcher) {
            answer = CompletableDeferred()
            fake.chapter = { chapterMindMap("drawing") }

            row(fromList = false) { store, _ ->
                store.chapter[key].load()
                show()
                advanceTimeBy(MindMapShown.Drawing.pollEvery.inWholeMilliseconds)
                runCurrent()

                fake.chapter = { chapterMindMap("ready") }
                cache.invalidate(setOf(DataDomain.UserSubscription))
                store.chapter[key].load()
                fake.chapter = { throw ApiException(ApiError.Network) }
                answer?.complete(ChapterMindMapStatus.Status.PLUS_REQUIRED)
                frame()

                assertEquals(MindMapShown.Ready, rendered)
            }
        }

    @Test
    fun buyingPlusAfterALockStoppedTheFollowAfterCreateShowsTheUnlockedMap() =
        runTest(dispatcher) {
            reads("available")

            row { store, maps ->
                loadBoth(store)
                show()
                reads("drawing")
                maps.create(key.chapterId)
                frame()
                assertEquals(MindMapShown.Drawing, rendered)

                lockWhileTheChapterIsRead(maps)
                buyPlus(store, "available")

                assertEquals(MindMapShown.Available, rendered)
            }
        }

    @Test
    fun buyingPlusAfterALockStoppedTheFollowOfANewStageShowsTheUnlockedMap() =
        runTest(dispatcher) {
            reads("writingLessons")

            row { store, maps ->
                loadBoth(store)
                show()
                moveOnToDrawing()

                lockWhileTheChapterIsRead(maps)
                buyPlus(store, "available")

                assertEquals(MindMapShown.Available, rendered)
                assertTrue(fake.created.isEmpty())
            }
        }

    @Test
    fun buyingPlusShowsARunThatFailedInsteadOfItsOldProgress() =
        runTest(dispatcher) {
            reads("writingLessons")

            row { store, maps ->
                loadBoth(store)
                show()
                moveOnToDrawing()

                lockWhileTheChapterIsRead(maps)
                buyPlus(store, "failed")

                assertEquals(MindMapShown.Failed, rendered)
            }
        }

    private fun reads(status: String) {
        fake.chapter = { chapterMindMap(status) }
        fake.mindMaps = { goalMindMaps(listOf(mapJson(3, "Waves", status))) }
    }

    private suspend fun loadBoth(store: MindMapStore) {
        store.list[key.goalId].load()
        store.chapter[key].load()
    }

    /** The run moves on to drawing, as the status and the server's reads both say. */
    private fun RowScope.moveOnToDrawing() {
        fake.statuses.add(ChapterMindMapStatus.Status.DRAWING)
        reads("drawing")
        test.advanceTimeBy(MindMapShown.WritingLessons.pollEvery.inWholeMilliseconds)
        frame()
        assertEquals(MindMapShown.Drawing, rendered)
    }

    /** The list reads the lock and the row shows it, which stops the follow while the chapter's read is still out. */
    private fun RowScope.lockWhileTheChapterIsRead(maps: MindMapViewModel) {
        val reading = CompletableDeferred<Unit>()
        holdChapter = reading
        fake.statuses.add(ChapterMindMapStatus.Status.PLUS_REQUIRED)
        fake.mindMaps = { goalMindMaps(listOf(mapJson(3, "Waves", "plusRequired"))) }
        test.advanceTimeBy(MindMapShown.Drawing.pollEvery.inWholeMilliseconds)
        frame()
        assertTrue(reading.isCompleted)
        assertEquals(MindMapShown.PlusRequired, rendered)
        assertNull(maps.requests.value[key.chapterId])
        holdChapter = null
    }

    private suspend fun RowScope.buyPlus(
        store: MindMapStore,
        status: String,
    ) {
        reads(status)
        cache.invalidate(setOf(DataDomain.UserSubscription))
        loadBoth(store)
        frame()
        // Three polls' worth: nothing left behind keeps following and gives up as unreachable.
        test.advanceTimeBy(MAX_POLLS * MindMapShown.Drawing.pollEvery.inWholeMilliseconds + 1)
        frame()
    }

    private class RowScope(
        val test: TestScope,
        val cache: AppCache,
        private val clock: BroadcastFrameClock,
        private val compose: () -> Unit,
    ) {
        var rendered: MindMapShown? = null

        fun show() {
            compose()
            test.runCurrent()
        }

        fun frame() {
            test.runCurrent()
            Snapshot.sendApplyNotifications()
            test.runCurrent()
            clock.sendFrame(test.currentTime * NANOS_PER_MILLI + 1)
            test.runCurrent()
        }
    }

    /** A row shown from the goal's list ([fromList]) or the chapter's own read, with the real follow effect. */
    private suspend fun TestScope.row(
        fromList: Boolean = true,
        block: suspend RowScope.(MindMapStore, MindMapViewModel) -> Unit,
    ) {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        val cache = AppCache(FakeSession(ana), scope)
        val store = MindMapStore(api, cache)
        val maps = MindMapViewModel(store, ana, key.goalId, { ana }, io = dispatcher)
        val clock = BroadcastFrameClock()
        val recomposer = Recomposer(backgroundScope.coroutineContext + clock)
        backgroundScope.launch(clock) { recomposer.runRecomposeAndApplyChanges() }
        val composition = Composition(NoNodes, recomposer)
        lateinit var rowScope: RowScope
        rowScope =
            RowScope(this, cache, clock) {
                composition.setContent {
                    CompositionLocalProvider(LocalLifecycleOwner provides Started) {
                        val list by store.list[key.goalId].state.collectAsState()
                        val read by store.chapter[key].state.collectAsState()
                        val requests by maps.requests.collectAsState()
                        val server =
                            if (fromList) {
                                list.value!!
                                    .chapters
                                    .single()
                                    .status.shown
                            } else {
                                read.value!!.status.shown
                            }
                        val shown = shownMindMap(server, requests[key.chapterId])
                        FollowWhileOnItsWay(maps, key.chapterId, shown)
                        SideEffect { rowScope.rendered = shown }
                    }
                }
            }

        try {
            rowScope.block(store, maps)
        } finally {
            composition.dispose()
            recomposer.cancel()
            scope.cancel()
        }
    }

    private object Started : LifecycleOwner {
        override val lifecycle = LifecycleRegistry.createUnsafe(this).apply { currentState = Lifecycle.State.STARTED }
    }

    private object NoNodes : AbstractApplier<Unit>(Unit) {
        override fun insertTopDown(
            index: Int,
            instance: Unit,
        ) = Unit

        override fun insertBottomUp(
            index: Int,
            instance: Unit,
        ) = Unit

        override fun remove(
            index: Int,
            count: Int,
        ) = Unit

        override fun move(
            from: Int,
            to: Int,
            count: Int,
        ) = Unit

        override fun onClear() = Unit
    }

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000L
        const val MAX_POLLS = 3
    }
}
