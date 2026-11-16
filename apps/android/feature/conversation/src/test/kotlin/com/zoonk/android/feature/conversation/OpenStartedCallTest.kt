package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.HeldRuns
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class OpenStartedCallTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val call = UUID.fromString("00000000-0000-4000-8000-0000000000c2")

    @Test
    fun aPracticeWaitEndsWithItsSheetAndTheNextOpeningCanStart() = practiceWait(late = false)

    @Test
    fun aLatePracticeGenerationAnswerCannotInstallAWaitOnTheNextOpening() = practiceWait(late = true)

    private fun practiceWait(late: Boolean) {
        val runs = HeldRuns()
        val answer = CompletableDeferred<CallStart>()
        var starts = 0
        val model =
            CallStartModel(
                callStarter(runs) {
                    starts++
                    if (starts == 1) answer.await() else CallStart.Started(call)
                },
                GenerationKind.ConversationCall,
            )
        val opened = mutableListOf<UUID>()
        var shown by mutableStateOf(true)
        compose.setContent { if (shown) OpenStartedCall(model) { opened += it } }
        val request = CallRequest.Practice(UUID.randomUUID(), null, 5)
        compose.runOnIdle { model.start(request) }
        if (!late) {
            answer.complete(CallStart.Writing("run-1"))
            compose.waitForIdle()
            assertEquals("run-1", model.writing.generationId.value)
        }
        shown = false
        compose.waitForIdle()
        shown = true
        compose.waitForIdle()
        if (late) answer.complete(CallStart.Writing("run-1"))
        compose.waitForIdle()
        assertNull(model.writing.generationId.value)
        assertEquals(CallStartModel.State.Idle, model.state)
        runs.write()
        compose.waitForIdle()
        assertEquals(1, starts)
        assertEquals(emptyList<UUID>(), opened)
        compose.runOnIdle { model.start(request) }
        compose.waitForIdle()
        assertEquals(listOf(call), opened)
    }

    @Test
    fun aCallThatStartsAfterTheLearnerLeftOpensNothingOnReturn() {
        val answer = CompletableDeferred<CallStart>()
        val model = CallStartModel(callStarter { answer.await() }, GenerationKind.ConversationCall)
        val opened = mutableListOf<UUID>()
        var shown by mutableStateOf(true)
        compose.setContent { if (shown) OpenStartedCall(model) { opened += it } }

        compose.runOnIdle { model.start(CallRequest.SpeakingMock(UUID.randomUUID())) }
        shown = false
        compose.waitForIdle()
        answer.complete(CallStart.Started(call))
        compose.waitForIdle()
        shown = true
        compose.waitForIdle()

        assertEquals(emptyList<UUID>(), opened)
    }

    @Test
    fun aCallThatStartsWhileTheScreenIsRecreatedOpensOnce() {
        val answer = CompletableDeferred<CallStart>()
        val model = CallStartModel(callStarter { answer.await() }, GenerationKind.ConversationCall)
        val opened = mutableListOf<UUID>()
        var shown by mutableStateOf(false)
        compose.setContent { if (shown) OpenStartedCall(model) { opened += it } }

        // No screen shows while the start answers, as when the window is recreated, and the visit goes on.
        compose.runOnIdle { model.start(CallRequest.SpeakingMock(UUID.randomUUID())) }
        answer.complete(CallStart.Started(call))
        compose.waitForIdle()
        shown = true
        compose.waitForIdle()

        assertEquals(listOf(call), opened)
    }

    @Test
    fun aStartThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = failure(leaveFirst = true)

    @Test
    fun aStartFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = failure(leaveFirst = false)

    private fun failure(leaveFirst: Boolean) {
        val answer = CompletableDeferred<CallStart>()
        val model = CallStartModel(callStarter { answer.await() }, GenerationKind.ConversationCall)

        compose.runOnIdle { model.start(CallRequest.SpeakingMock(UUID.randomUUID())) }
        compose.waitForIdle()
        if (leaveFirst) compose.runOnIdle { model.visit.end() }
        answer.complete(CallStart.Failed)
        compose.waitForIdle()
        if (!leaveFirst) {
            assertEquals(CallStartModel.State.Failed, model.state)
            compose.runOnIdle { model.visit.end() }
        }

        assertEquals(CallStartModel.State.Idle, model.state)
    }

    /** The refusal goes in the access every screen reads, written by the model's own store call, whichever screen shows then. */
    @Test
    fun aRefusalThatAnswersWhileNoScreenShowsIsWrittenOnce() {
        val answer = CompletableDeferred<CallStart>()
        var refusals = 0
        val model = CallStartModel(callStarter { answer.await() }, GenerationKind.ExamSpeaking) { refusals++ }

        compose.runOnIdle { model.start(CallRequest.ExamSpeaking(UUID.randomUUID(), "task-1")) }
        answer.complete(CallStart.PlusRequired)
        compose.waitForIdle()

        assertEquals(1, refusals)
        assertEquals(CallStartModel.State.PlusRequired, model.state)
    }
}
