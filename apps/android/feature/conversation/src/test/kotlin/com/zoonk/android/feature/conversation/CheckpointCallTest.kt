package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
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
    fun gettingTheCallReadyWaitsOnTheRunWritingItThenOpensOnItsIntro() {
        harness.api.checkpoint = checkpointStatus("""{"status":"preparing","unitTitle":"At the café"}""")
        harness.api.writings += "run-1"
        show()

        compose.onNodeWithText("Get the call ready").performClick()
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
