package com.zoonk.android.feature.essay

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.feature.practice.UnusedSessionSteps
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Essay
import com.zoonk.api.models.WritingDraft
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.UUID
import kotlin.time.Duration.Companion.days
import kotlin.time.Duration.Companion.minutes
import kotlin.time.TestTimeSource

@OptIn(ExperimentalCoroutinesApi::class)
class EssayViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val session = AuthenticatedSession(ANA, "token", "local")
    private val clock = TestTimeSource()
    private val network = MutableSharedFlow<Unit>()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    /** One device: its view models share the drafts kept on disk, as a reopened screen or a restarted app would. */
    private inner class Device(
        scope: TestScope,
        val api: FakeEssayApi,
    ) {
        // The app's scope runs in the test's time, unlike background work, so what a save waits on runs before the test reads it.
        private val app = CoroutineScope(SupervisorJob() + dispatcher)
        private val drafts = DraftStore(folder.newFolder(), app, io = dispatcher)
        val store = EssayStore(api, AppCache(FakeSession(session), app), drafts) { "UTC" }
        val kept = store.keptText(session, ESSAY_BLOCK)

        init {
            scope.launch { drafts.follow { DraftsChange(next = session.accountId) } }
        }

        suspend fun TestScope.open(): EssayViewModel {
            advanceUntilIdle()
            val viewModel = EssayViewModel(ESSAY_BLOCK, ESSAY_SESSION, store, kept, UnusedSessionSteps, app, network, clock)
            viewModel.essay.prepare()
            viewModel.arrive((viewModel.essay.state.value as LoadState.Loaded<*>).value as Essay)
            advanceUntilIdle()
            return viewModel
        }

        /** What a past visit kept on this device. */
        suspend fun TestScope.keptBefore(writing: KeptWriting) {
            advanceUntilIdle()
            kept.save(writing)
        }

        suspend fun keptOnDisk(): KeptWriting? {
            kept.flush()
            return kept.value.first()
        }
    }

    private suspend fun TestScope.opened(api: FakeEssayApi): EssayViewModel = with(Device(this, api)) { open() }

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
    fun aDraftSavedOnAnotherDeviceStopsSavingAndAsksBeforeAnythingIsOverwritten() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi(essay(draft = "Started on the phone.", draftRevision = 1)))
            device.api.saveAnswers += DraftSave.Conflict(WritingDraft(ADMISSION, 2, "Edited on the laptop."))
            val viewModel = with(device) { open() }

            viewModel.startWriting()
            viewModel.write("Started on the phone, and finished here.")
            advanceUntilIdle()
            viewModel.write("Started on the phone, and finished here. More.")
            advanceUntilIdle()

            assertEquals(listOf(1L), device.api.saved.map { it.revision })
            assertEquals(WritingDraft(ADMISSION, 2, "Edited on the laptop."), viewModel.ui.value.conflict)
            assertEquals("Started on the phone, and finished here. More.", viewModel.ui.value.text)
            assertEquals("Started on the phone, and finished here. More.", device.keptOnDisk()?.text)

            viewModel.keepThis()
            advanceUntilIdle()

            assertEquals(
                2L,
                device.api.saved
                    .last()
                    .revision,
            )
            assertEquals(
                "Started on the phone, and finished here. More.",
                device.api.saved
                    .last()
                    .text,
            )
            assertNull(viewModel.ui.value.conflict)
            assertNull(device.keptOnDisk())
        }

    @Test
    fun usingTheOtherDevicesDraftReplacesTheTextHereAndSavesNothing() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi(essay(draft = "Started on the phone.", draftRevision = 1)))
            device.api.saveAnswers += DraftSave.Conflict(WritingDraft(ADMISSION, 2, "Edited on the laptop."))
            val viewModel = with(device) { open() }

            viewModel.write("Typed here.")
            advanceUntilIdle()
            viewModel.useOther()
            advanceUntilIdle()

            assertEquals("Edited on the laptop.", viewModel.ui.value.text)
            assertEquals(1, device.api.saved.size)
            assertNull(device.keptOnDisk())

            viewModel.write("Edited on the laptop, then here.")
            advanceUntilIdle()
            assertEquals(
                2L,
                device.api.saved
                    .last()
                    .revision,
            )
        }

    @Test
    fun aConflictFoundWhileSendingStopsGradingUntilTheLearnerChooses() =
        runTest(dispatcher) {
            val api = FakeEssayApi(essay(draft = "Started here."))
            val other = WritingDraft(ADMISSION, 2, "Edited on the laptop.")
            api.saveAnswers += DraftSave.Conflict(other)
            api.grade = { result(LEVELS_RESULT) }
            val device = Device(this, api)
            val viewModel = with(device) { open() }

            viewModel.write(ANSWER_TEXT)
            viewModel.send()
            advanceUntilIdle()

            assertEquals(emptyList<Any>(), api.submitted)
            assertEquals(WritingSend.Idle, viewModel.ui.value.send)
            assertEquals(other, viewModel.ui.value.conflict)
            assertEquals(ANSWER_TEXT, device.keptOnDisk()?.text)
        }

    @Test
    fun aSavesAnswerKeepsWhatWasTypedWhileItWasOut() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi())
            val viewModel = with(device) { open() }
            val gate = CompletableDeferred<Unit>()
            device.api.saveGate = gate

            viewModel.write("first")
            advanceTimeBy(2_000)
            assertEquals(listOf("first"), device.api.saved.map { it.text })
            viewModel.write("first plus a new paragraph")
            device.api.saveGate = null
            gate.complete(Unit)
            advanceTimeBy(100)

            assertEquals(
                KeptWriting("first plus a new paragraph", 1, ADMISSION.toString()),
                device.keptOnDisk()?.copy(writingMs = 0, version = null),
            )
            assertEquals("first plus a new paragraph", viewModel.ui.value.text)

            advanceUntilIdle()
            assertEquals(listOf(0L to "first", 1L to "first plus a new paragraph"), device.api.saved.map { it.revision to it.text })
            assertNull(device.keptOnDisk())
        }

    @Test
    fun aSavesAnswerKeepsTheReopenedEditorsDraft() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi())
            val first = with(device) { open() }
            val second = with(device) { open() }
            val gate = CompletableDeferred<Unit>()
            device.api.saveGate = gate

            first.write("First editor")
            advanceTimeBy(2_000)
            assertEquals(listOf("First editor"), device.api.saved.map { it.text })
            second.write("Unsaved in the second editor")
            runCurrent()
            device.api.saveGate = null
            gate.complete(Unit)
            runCurrent()

            assertEquals("Unsaved in the second editor", device.keptOnDisk()?.text)
        }

    @Test
    fun leavingSavesWhatAFailedSaveLeftOutWithoutAnotherKey() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi())
            val viewModel = with(device) { open() }
            device.api.saveError = ApiException(ApiError.Network)

            viewModel.write("Typed offline.")
            advanceUntilIdle()
            assertEquals("Typed offline.", device.keptOnDisk()?.text)
            assertEquals(true, viewModel.ui.value.saveFailed)

            device.api.saveError = null
            viewModel.onStop()
            advanceUntilIdle()

            assertEquals(
                "Typed offline.",
                device.api.saved
                    .last()
                    .text,
            )
            assertEquals(2, device.api.saved.size)
            assertNull(device.keptOnDisk())
            assertEquals(false, viewModel.ui.value.saveFailed)
        }

    @Test
    fun theNetworkComingBackSavesWhatWasTypedOffline() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi())
            val viewModel = with(device) { open() }
            device.api.saveError = ApiException(ApiError.Network)

            viewModel.write("Typed offline.")
            advanceUntilIdle()
            device.api.saveError = null
            network.emit(Unit)
            advanceUntilIdle()

            assertEquals(listOf("Typed offline.", "Typed offline."), device.api.saved.map { it.text })
            assertNull(device.keptOnDisk())
        }

    @Test
    fun openingAnAnswerAsksTheServerForNothing() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi())
            with(device) { keptBefore(KeptWriting("Typed before the app closed.", 0, ADMISSION.toString())) }

            val viewModel = with(device) { open() }

            assertEquals("Typed before the app closed.", viewModel.ui.value.text)
            assertEquals(emptyList<Any>(), device.api.started)
        }

    @Test
    fun aCopyKeptUnderAnotherAdmissionIsNeverOffered() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi(essay(draft = "The rewrite started on the laptop.", draftRevision = 1)))
            with(device) { keptBefore(KeptWriting("The first answer, typed here.", 9, "00000000-0000-4000-8000-0000000000a9")) }

            val viewModel = with(device) { open() }

            assertEquals("The rewrite started on the laptop.", viewModel.ui.value.text)
            assertNull(device.keptOnDisk())
        }

    @Test
    fun anAnswerClearedOnThisDeviceStaysCleared() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi(essay(draft = "old", draftRevision = 3)))
            with(device) { keptBefore(KeptWriting("", 3, ADMISSION.toString())) }

            val viewModel = with(device) { open() }

            assertEquals("", viewModel.ui.value.text)
            assertEquals(
                SaveExpectation(3, ""),
                device.api.saved
                    .single()
                    .let { SaveExpectation(it.revision, it.text) },
            )
        }

    @Test
    fun aSaveThatLandedWithoutItsAnswerDoesNotHideTheTextTypedAfterIt() =
        runTest(dispatcher) {
            // "first" was out at revision 0 and "second" kept when the app died; the server took "first" as revision 1.
            val device = Device(this, FakeEssayApi(essay(draft = "first", draftRevision = 1)))
            with(device) { keptBefore(KeptWriting("second", 0, ADMISSION.toString(), sending = "first")) }

            val viewModel = with(device) { open() }

            assertEquals("second", viewModel.ui.value.text)
            assertNull(viewModel.ui.value.conflict)
            assertEquals(
                SaveExpectation(1, "second"),
                device.api.saved
                    .single()
                    .let { SaveExpectation(it.revision, it.text) },
            )
        }

    @Test
    fun aNewerDraftFromElsewhereOnReopeningKeepsBothAndAsks() =
        runTest(dispatcher) {
            val device = Device(this, FakeEssayApi(essay(draft = "Saved on the laptop.", draftRevision = 4)))
            with(device) { keptBefore(KeptWriting("Typed here before.", 2, ADMISSION.toString())) }

            val viewModel = with(device) { open() }

            assertEquals("Typed here before.", viewModel.ui.value.text)
            assertEquals(
                "Saved on the laptop.",
                viewModel.ui.value.conflict
                    ?.text,
            )
            assertEquals(emptyList<Any>(), device.api.saved)
        }

    @Test
    fun aSavedDraftOpensOnTheQuestionToContinue() =
        runTest(dispatcher) {
            val viewModel = opened(FakeEssayApi(essay(draft = "Half an answer.", graded = listOf(LEVELS_RESULT))))
            assertEquals(WritingMode.Question, viewModel.ui.value.mode)
            assertEquals("Half an answer.", viewModel.ui.value.text)
        }

    @Test
    fun aDraftSavedOnLeavingOpensAgainInTheSameApp() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            val device = Device(this, api)
            val first = with(device) { open() }
            val text = "Public money must be spent lawfully.\nEach branch checks its own acts.\nCongress exercises external control."
            first.startWriting()
            first.write(text)
            first.onStop()
            advanceUntilIdle()

            assertEquals(text, api.saved.single().text)
            assertNull(device.keptOnDisk())
            api.read = essay(draft = text, draftRevision = 1)
            first.essay.invalidate()

            val reopened = with(device) { open() }
            reopened.essay.load()
            reopened.arrive((reopened.essay.state.value as LoadState.Loaded).value)
            reopened.startWriting()
            assertEquals(text, reopened.ui.value.text)

            reopened.write("$text\nThe two controls complement each other.")
            reopened.onStop()
            advanceUntilIdle()
            assertEquals(1L, api.saved.last().revision)
        }

    @Test
    fun nothingTypedWhileGradingIsTakenAndTheResultIsForWhatWasSent() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            val answer = CompletableDeferred<Unit>()
            api.grade = {
                answer.await()
                result(LEVELS_RESULT)
            }
            val viewModel = opened(api)

            viewModel.startWriting()
            viewModel.write(ANSWER_TEXT)
            viewModel.send()
            runCurrent()
            viewModel.write("$ANSWER_TEXT And more.")
            assertEquals(ANSWER_TEXT, viewModel.ui.value.text)

            answer.complete(Unit)
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
    fun aGradeReplayedForTheFirstSendKeepsTheChangedTextForARewrite() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.grade = { throw ApiException(ApiError.Network) }
            val device = Device(this, api)
            val viewModel = with(device) { open() }

            viewModel.write(ANSWER_TEXT)
            viewModel.send()
            advanceUntilIdle()
            assertEquals(WritingSend.Failed, viewModel.ui.value.send)

            // The first send was graded; its answer was lost. The server replays that grade for any text.
            api.read = essay(graded = listOf(LEVELS_RESULT))
            api.grade = { result(LEVELS_RESULT) }
            viewModel.write("$ANSWER_TEXT Changed after the failure.")
            viewModel.send()
            advanceUntilIdle()

            assertEquals(
                ANSWER_TEXT,
                viewModel.ui.value.latest
                    ?.text,
            )
            assertEquals("$ANSWER_TEXT Changed after the failure.", viewModel.ui.value.unsent)

            val kept = checkNotNull(device.keptOnDisk())
            assertEquals(ADMISSION.toString(), kept.admissionId)
            viewModel.onStop()
            advanceUntilIdle()
            val restored = with(device) { open() }
            assertEquals(WritingMode.Result, restored.ui.value.mode)
            assertEquals(kept.text, restored.ui.value.unsent)
            assertEquals("", restored.ui.value.text)

            api.defaultStart = WritingStartAnswer.Ready(UUID.randomUUID())
            restored.rewrite()
            advanceUntilIdle()
            assertEquals("$ANSWER_TEXT Changed after the failure.", restored.ui.value.text)
            assertEquals(api.defaultStart, WritingStartAnswer.Ready(api.saved.last().admissionId))
        }

    @Test
    fun aGradeReplayedAfterReopeningKeepsTheChangedTextForARewrite() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.grade = { throw ApiException(ApiError.Network) }
            val device = Device(this, api)
            val first = with(device) { open() }
            val changed = "$ANSWER_TEXT Changed after the failure."

            first.write(ANSWER_TEXT)
            first.send()
            advanceUntilIdle()
            assertEquals(WritingSend.Failed, first.ui.value.send)

            // The server graded the first text before the response was lost, so it no longer takes draft saves.
            repeat(3) { api.saveAnswers += DraftSave.Closed }
            first.write(changed)
            first.onStop()
            advanceUntilIdle()
            assertEquals(changed, device.keptOnDisk()?.text)

            val reopened = with(device) { open() }
            reopened.startWriting()
            assertEquals(changed, reopened.ui.value.text)

            val grade = result(LEVELS_RESULT)
            api.grade = {
                api.read = essay(graded = listOf(LEVELS_RESULT))
                grade
            }
            reopened.send()
            advanceUntilIdle()

            assertEquals(listOf(ADMISSION to ANSWER_TEXT, ADMISSION to changed), api.submitted.map { it.admissionId to it.text })
            assertEquals(WritingMode.Result, reopened.ui.value.mode)
            assertEquals(GradedAnswer(grade, ANSWER_TEXT, null), reopened.ui.value.latest)
            assertEquals(changed, reopened.ui.value.unsent)
            assertEquals(changed, device.keptOnDisk()?.text)

            api.defaultStart = WritingStartAnswer.Ready(UUID.randomUUID())
            reopened.rewrite()
            advanceUntilIdle()
            assertEquals(changed, reopened.ui.value.text)
        }

    @Test
    fun anotherAdmissionDoesNotGetTheEditsKeptForAReplayedGrade() =
        runTest(dispatcher) {
            val api = FakeEssayApi(essay(graded = listOf(LEVELS_RESULT)).copy(admissionId = UUID.randomUUID()))
            val device = Device(this, api)
            with(device) { keptBefore(KeptWriting("Changed text", 1, ADMISSION.toString(), replayed = true)) }

            val restored = with(device) { open() }

            assertEquals(WritingMode.Result, restored.ui.value.mode)
            assertNull(restored.ui.value.unsent)
            assertNull(device.keptOnDisk())
            assertEquals(emptyList<Any>(), api.saved)
        }

    @Test
    fun aRestoredRouteDoesNotFollowARequestOrStartAgain() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            val device = Device(this, api)
            val runs = WritingRuns(write = "writeWritingPrompt", ready = "ready")

            for (outcome in listOf("run-1", "failed", "signUp", "limit", "removed")) {
                val live = AppRoute.Essay(ESSAY_BLOCK.toString(), writing = outcome, taskDescription = "Old task", drill = true)
                val saved = ApiJson.encodeToString(AppRoute.serializer(), live)
                val restored = ApiJson.decodeFromString(AppRoute.serializer(), saved) as AppRoute.Essay
                assertEquals(AppRoute.Essay(ESSAY_BLOCK.toString()), restored)
                val model = WritingStartViewModel(ESSAY_BLOCK, WritingBefore.of(restored.writing), restored.drill, device.store, runs)
                advanceUntilIdle()
                assertEquals(WritingStartState.Available, model.state.value)
            }

            assertEquals(emptyList<String>(), runs.followed)
            assertEquals(emptyList<UUID?>(), api.started)
        }

    @Test
    fun aLinkToAQuestionOnlyStartsAfterWriteIsTapped() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            val device = Device(this, api)
            val runs = WritingRuns(write = "writeWritingPrompt", ready = "ready")
            val link = AppLink.parse("/essay/$ESSAY_BLOCK?writing=run-1") as AppRoute.Essay
            val model = WritingStartViewModel(ESSAY_BLOCK, WritingBefore.of(link.writing), link.drill, device.store, runs)

            advanceUntilIdle()
            assertEquals(WritingStartState.Available, model.state.value)
            assertEquals(emptyList<String>(), runs.followed)
            assertEquals(emptyList<UUID?>(), api.started)

            model.requestStart()
            advanceUntilIdle()
            assertEquals(WritingStartState.Ready, model.state.value)
            assertEquals(listOf<UUID?>(null), api.started)
        }

    @Test
    fun theFieldStopsAtTheLongestAnswerTheApiTakes() =
        runTest(dispatcher) {
            val viewModel = opened(FakeEssayApi())
            viewModel.write("a".repeat(MAX_WRITING_CHARACTERS + 1))
            assertEquals("", viewModel.ui.value.text)
            viewModel.write("a".repeat(MAX_WRITING_CHARACTERS))
            assertEquals(MAX_WRITING_CHARACTERS, viewModel.ui.value.text.length)
        }

    @Test
    fun writingTimeIsTimeOnScreenAndNeverPastWhatTheApiTakes() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.grade = { result(LEVELS_RESULT) }
            val viewModel = opened(api)

            viewModel.write("Started.")
            clock += 5.minutes
            viewModel.onStop()
            clock += 3.days
            viewModel.write(ANSWER_TEXT)
            clock += 2.minutes
            viewModel.send()
            advanceUntilIdle()
            assertEquals(7.minutes.inWholeMilliseconds, api.submitted.single().durationMs)

            val long = FakeEssayApi()
            long.grade = { result(LEVELS_RESULT) }
            val left = opened(long)
            left.write(ANSWER_TEXT)
            clock += 2.days
            left.send()
            advanceUntilIdle()
            assertEquals(1.days.inWholeMilliseconds, long.submitted.single().durationMs)
        }

    @Test
    fun aStartTheNoticeNoLongerAsksForIsRemovedNotAFailure() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.startError = ApiException(ApiError.Unavailable, status = 409)

            assertEquals(WritingStartAnswer.Removed, api.startAnswer(session, ESSAY_BLOCK))
            assertEquals("removed", api.startRoute(session, ESSAY_BLOCK).writing)
        }

    @Test
    fun aGuestWhoMustSignUpIsToldSoNotToTryAgain() =
        runTest(dispatcher) {
            val api = FakeEssayApi()
            api.startError = ApiException(ApiError.Unavailable, "SIGN_UP_REQUIRED", status = 403)

            assertEquals(WritingBefore.SignUpRequired, WritingBefore.of(api.startRoute(session, ESSAY_BLOCK).writing))
        }

    @Test
    fun aRewriteRefusedForTheDayIsRefusedBeforeAnythingIsWritten() =
        runTest(dispatcher) {
            val api = FakeEssayApi(essay(graded = listOf(LEVELS_RESULT)))
            val viewModel = opened(api)
            assertEquals(WritingMode.Result, viewModel.ui.value.mode)
            api.starts += WritingStartAnswer.LimitReached(TOMORROW)

            viewModel.rewrite()
            advanceUntilIdle()

            assertEquals(ATTEMPT, api.started.last())
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
            assertNotNull(api.saved.lastOrNull())
        }

    private data class SaveExpectation(
        val revision: Long,
        val text: String,
    )
}
