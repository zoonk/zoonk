package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.questions.Answer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class MockRunnerViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val ana = AuthenticatedSession("ana", "token", "local")
    private val session = FakeSession(ana)
    private val api = FakeMockRunApi()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    @Test
    fun answersLeftOnTheDeviceGoOutWhenTheMockOpensAgain() =
        runTest(dispatcher) {
            val scope = CoroutineScope(SupervisorJob() + dispatcher)
            val drafts = DraftStore(folder.root, scope, io = dispatcher)
            drafts.follow { DraftsChange(next = ana.accountId) }
            val store = MockRunStore(api, AppCache(session, scope), drafts) { "UTC" }
            val kept = MockDraft(ITEM_TWO, Answer.Choice(2), durationMs = 4000, flagged = true)
            store.unsent(ana, RUN_BLOCK).save(listOf(kept))

            val viewModel = MockRunnerViewModel(store, session, RUN_BLOCK, runningMock())
            advanceUntilIdle()

            assertEquals(kept, api.saved.single { it.itemId == ITEM_TWO })
            assertEquals(kept, viewModel.state.value.drafts[ITEM_TWO])
            assertEquals(null, store.unsent(ana, RUN_BLOCK).value.first())
        }

    @Test
    fun anAnswerThatCouldntBeSentStaysOnTheDevice() =
        runTest(dispatcher) {
            val scope = CoroutineScope(SupervisorJob() + dispatcher)
            val drafts = DraftStore(folder.root, scope, io = dispatcher)
            drafts.follow { DraftsChange(next = ana.accountId) }
            val store = MockRunStore(api, AppCache(session, scope), drafts) { "UTC" }
            api.saveFailure = UNREACHABLE

            val viewModel = MockRunnerViewModel(store, session, RUN_BLOCK, runningMock())
            viewModel.answer(Answer.Choice(1))
            dispatcher.scheduler.runCurrent()

            assertEquals(
                Answer.Choice(1),
                store
                    .unsent(ana, RUN_BLOCK)
                    .value
                    .first()
                    ?.single { it.itemId == ITEM_ONE }
                    ?.answer,
            )
            assertEquals(DraftSaveStatus.Retrying, viewModel.saveStatus.value)

            // Back online, the retry gets it through and the device lets it go.
            api.saveFailure = null
            advanceUntilIdle()
            assertEquals(Answer.Choice(1), api.saved.last { it.itemId == ITEM_ONE }.answer)
            assertEquals(null, store.unsent(ana, RUN_BLOCK).value.first())
        }
}
