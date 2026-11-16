package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.HeldRuns
import com.zoonk.android.data.writingWaits
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class CheckpointCallTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val block = UUID.fromString("00000000-0000-4000-8000-0000000000b1")
    private val harness = ConversationHarness()

    private fun show() {
        val model = CheckpointCallModel(block, harness.store)
        compose.setContent {
            ZoonkTheme {
                CheckpointCallContent(
                    model = model,
                    exits = harness.exits,
                    onToday = {},
                    conversation = { id, startWith -> harness.Conversation(id, startWith) },
                    otherwise = { Text("The duel") },
                )
            }
        }
    }

    @Test
    fun leavingCheckpointPreparationClearsItsWaitBeforeReturning() {
        val runs = HeldRuns()
        val sessions = FakeSession(AuthenticatedSession("ana", "token", "local"))
        val store = ConversationStore(harness.api, AppCache(sessions, harness.scope), writingWaits(runs, sessions))
        val model = CheckpointCallModel(block, store)
        harness.api.writings += "run-1"
        var shown by mutableStateOf(true)
        compose.setContent {
            if (shown) {
                ZoonkTheme {
                    CheckpointCallContent(model, harness.exits, {}, { _, _ -> }, {})
                }
            }
        }
        compose.runOnIdle { model.start(null) }
        compose.waitForIdle()
        assertEquals("run-1", model.writing.generationId.value)
        shown = false
        compose.waitForIdle()
        shown = true
        compose.waitForIdle()
        runs.write()
        compose.waitForIdle()
        assertNull(model.writing.generationId.value)
        assertNull(model.opened)
        assertEquals(1, harness.api.starts.size)
    }

    @Test
    fun aLateCheckpointGenerationAnswerCannotInstallAnotherWait() {
        val gate = CompletableDeferred<Unit>().also { harness.api.startGate = it }
        harness.api.writings += "run-1"
        val model = CheckpointCallModel(block, harness.store)
        compose.runOnIdle { model.start(null) }
        compose.waitForIdle()
        compose.runOnIdle { model.visit.end() }
        gate.complete(Unit)
        compose.waitForIdle()
        assertNull(model.writing.generationId.value)
        assertNull(model.opened)
        assertEquals(CheckpointCallModel.Start.Idle, model.start)
    }

    @Test
    fun gettingTheCallReadyWaitsOnTheRunWritingItThenOpensOnItsIntro() {
        harness.api.checkpoint = checkpointStatus("""{"status":"preparing","unitTitle":"At the café"}""")
        harness.api.writings += "run-1"
        show()

        compose.onNodeWithText("Start").performClick()
        compose.waitForIdle()

        assertEquals(listOf(CallRequest.Checkpoint(block), CallRequest.Checkpoint(block)), harness.api.starts)
        assertEquals(listOf("run-1"), harness.runs.followed)
        compose.onNodeWithText("Call Lucía").assertExists()
        assertTrue("A prepared call waits for its own Start", harness.client.connects.isEmpty())
    }

    @Test
    fun anIntroStartAnsweredWithARunReadsTheCheckpointAgain() {
        harness.api.writings += "run-1"
        show()
        compose.waitForIdle()
        val reads = harness.api.checkpointReads

        compose.onNodeWithText("Call Lucía").performClick()
        compose.waitForIdle()

        assertEquals(reads + 1, harness.api.checkpointReads)
        assertTrue(harness.runs.followed.isEmpty())
    }

    @Test
    fun aReadyCallOpensItsConversation() {
        harness.api.checkpoint = checkpointStatus("""{"status":"ready","conversationId":"${harness.id}"}""")
        show()

        compose.onNodeWithText("Call Lucía").assertExists()
        assertTrue(harness.api.starts.isEmpty())
    }

    @Test
    fun aDayThatMovedOnReadsTheCheckpointAgain() {
        harness.api.startRefusal = ApiException(ApiError.Unavailable, "BLOCK_FINISHED", 409)
        show()
        compose.waitForIdle()
        val reads = harness.api.checkpointReads

        compose.onNodeWithText("Call Lucía").performClick()
        compose.waitForIdle()

        assertEquals(reads + 1, harness.api.checkpointReads)
    }
}
