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
import com.zoonk.api.models.ChapterMindMapStatus
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/**
 * The real follow effect, which stops a poll only on the frame after the row changes: a poll's
 * answer can land in between.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(AndroidJUnit4::class)
class MindMapFollowEffectTest {
    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val key = ChapterKey(UUID.fromString(GOAL), UUID.fromString(mapChapter(3)))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun stop() = Dispatchers.resetMain()

    @Test
    fun aPollAnsweredBeforeBuyingPlusCantLockTheReadyRowItsEffectIsLeaving() =
        runTest(dispatcher) {
            val fake = FakeMindMapApi()
            val answer = CompletableDeferred<ChapterMindMapStatus.Status>()
            val api =
                object : MindMapApi by fake {
                    override suspend fun status(
                        session: AuthenticatedSession,
                        key: ChapterKey,
                    ): ChapterMindMapStatus.Status = answer.await()
                }
            val scope = CoroutineScope(SupervisorJob() + dispatcher)
            val cache = AppCache(FakeSession(ana), scope)
            val store = MindMapStore(api, cache)
            val maps = MindMapViewModel(store, ana, key.goalId, { ana }, io = dispatcher)
            val clock = BroadcastFrameClock()
            val recomposer = Recomposer(backgroundScope.coroutineContext + clock)
            backgroundScope.launch(clock) { recomposer.runRecomposeAndApplyChanges() }
            val composition = Composition(NoNodes, recomposer)
            var rendered: MindMapShown? = null

            try {
                fake.chapter = { chapterMindMap("drawing") }
                store.chapter[key].load()
                composition.setContent {
                    CompositionLocalProvider(LocalLifecycleOwner provides Started) {
                        val map by store.chapter[key].state.collectAsState()
                        val requests by maps.requests.collectAsState()
                        val shown = shownMindMap(map.value!!.status.shown, requests[key.chapterId])
                        FollowWhileOnItsWay(maps, key.chapterId, shown)
                        SideEffect { rendered = shown }
                    }
                }
                runCurrent()
                advanceTimeBy(MindMapShown.Drawing.pollEvery.inWholeMilliseconds)
                runCurrent()

                fake.chapter = { chapterMindMap("ready") }
                cache.invalidate(setOf(DataDomain.UserSubscription))
                store.chapter[key].load()
                fake.chapter = { throw ApiException(ApiError.Network) }
                answer.complete(ChapterMindMapStatus.Status.PLUS_REQUIRED)
                runCurrent()
                Snapshot.sendApplyNotifications()
                runCurrent()
                clock.sendFrame(FRAME_NANOS)
                runCurrent()

                assertEquals(MindMapShown.Ready, rendered)
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
        const val FRAME_NANOS = 16_000_000L
    }
}
