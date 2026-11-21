package com.zoonk.android.feature.essay

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.UnusedSessionSteps
import com.zoonk.api.models.Essay
import com.zoonk.api.models.WritingDraft
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class EssayViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private suspend fun TestScope.opened(api: FakeEssayApi): EssayViewModel {
        val cache = AppCache(FakeSession(AuthenticatedSession(ANA, "token", "local")), backgroundScope)
        val store = EssayStore(api, cache, DraftStore(folder.root, backgroundScope)) { "UTC" }
        val viewModel = EssayViewModel(api.read.blockId, api.read.sessionId, store, null, UnusedSessionSteps)
        viewModel.essay.refresh()
        viewModel.arrive((viewModel.essay.state.value as LoadState.Loaded<*>).value as Essay)
        advanceUntilIdle()
        return viewModel
    }

    @Test
    fun everyResultShapeDecodes() {
        val levels = result(LEVELS_RESULT).toGrade()
        assertNull(levels.points)
        assertEquals(listOf("strong", "partial", "complete"), levels.criteria.map { it.level.value })

        val points = result(POINTS_RESULT).toGrade().points!!
        assertEquals(16.6, points.total.low, 0.0)
        assertEquals(0.4, points.deduction.high, 0.0)
        assertEquals(3, points.rows.size)

        assertEquals("An answer off the topic asked gets zero.", result(ZEROED_RESULT).toGrade().points!!.zeroReason)
    }

    @Test
    fun aSaveThatMeetsAnotherDevicesDraftKeepsTheTextTypedHereOverIt() =
        runTest(dispatcher) {
            val api = FakeEssayApi(essay(draft = "Started on the phone.", draftRevision = 1))
            api.saveAnswers += DraftSave.Conflict(WritingDraft(ADMISSION, 2, "Edited on the laptop."))
            val viewModel = opened(api)

            viewModel.startWriting()
            viewModel.write("Started on the phone, and finished here.")
            advanceUntilIdle()

            assertEquals(listOf(1L, 2L), api.saved.map { it.revision })
            assertEquals(listOf("Started on the phone, and finished here."), api.saved.map { it.text }.distinct())
            assertEquals("Started on the phone, and finished here.", viewModel.ui.value.text)
        }

    @Test
    fun aStartTheNoticeNoLongerAsksForIsRemovedNotAFailure() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.startError =
                com.zoonk.android.data
                    .ApiException(com.zoonk.android.data.ApiError.Unavailable, status = 409)
            val session = AuthenticatedSession(ANA, "token", "local")

            assertEquals(WritingStartAnswer.Removed, api.startAnswer(session, ESSAY_BLOCK))
            assertEquals("removed", api.startRoute(session, ESSAY_BLOCK).writing)
        }

    @Test
    fun aDraftSavedOnAnotherDeviceWinsOverAnOlderOneKeptHere() {
        val saved = "Continued on the laptop."
        assertEquals(saved, chooseDraftText(KeptWriting("Typed here before.", base = 1), saved, savedRevision = 2))
        assertEquals("Typed here after.", chooseDraftText(KeptWriting("Typed here after.", base = 2), saved, savedRevision = 2))
        assertEquals(saved, chooseDraftText(KeptWriting("  ", base = 3), saved, savedRevision = 2))
    }

    @Test
    fun aSavedDraftOpensOnTheQuestionToContinue() =
        runTest(dispatcher) {
            val viewModel = opened(FakeEssayApi(essay(draft = "Half an answer.", graded = listOf(LEVELS_RESULT))))
            assertEquals(WritingMode.Question, viewModel.ui.value.mode)
            assertEquals("Half an answer.", viewModel.ui.value.text)
        }

    @Test
    fun anAnswerIsSentWithItsAdmissionAndItsResultShows() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.grade = { result(LEVELS_RESULT) }
            val viewModel = opened(api)

            viewModel.startWriting()
            viewModel.write(ANSWER_TEXT)
            viewModel.send()
            advanceUntilIdle()

            assertEquals(ADMISSION, api.submitted.single().admissionId)
            assertEquals(WritingMode.Result, viewModel.ui.value.mode)
            assertEquals(
                ANSWER_TEXT,
                viewModel.ui.value.latest
                    ?.text,
            )
        }

    @Test
    fun aRewriteRefusedForTheDayIsRefusedBeforeAnythingIsWritten() =
        runTest(dispatcher) {
            val api = FakeEssayApi(essay(graded = listOf(LEVELS_RESULT)))
            api.starts += WritingStartAnswer.LimitReached(TOMORROW)
            val viewModel = opened(api)
            assertEquals(WritingMode.Result, viewModel.ui.value.mode)

            viewModel.rewrite()
            advanceUntilIdle()

            assertEquals(listOf(ATTEMPT), api.started)
            assertEquals(WritingMode.Refused, viewModel.ui.value.mode)
            assertEquals(emptyList<Any>(), api.saved)
        }

    @Test
    fun anAdmittedRewriteStartsFromTheGradedText() =
        runTest(dispatcher) {
            val api = FakeEssayApi(essay(graded = listOf(LEVELS_RESULT)))
            val viewModel = opened(api)

            viewModel.rewrite()
            advanceUntilIdle()

            assertEquals(WritingMode.Write, viewModel.ui.value.mode)
            assertEquals(ANSWER_TEXT, viewModel.ui.value.text)
        }
}
