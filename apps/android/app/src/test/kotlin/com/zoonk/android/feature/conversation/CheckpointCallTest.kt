package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.feature.livecall.LiveServerEvent
import com.zoonk.android.navigation.AppRoute
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
    private var today = 0

    private fun show() {
        val model = CheckpointCallModel(block, harness.store)
        compose.setContent {
            ZoonkTheme {
                CheckpointCallContent(
                    model = model,
                    exits = harness.exits,
                    onToday = { today++ },
                    conversation = { id, startWith -> harness.Conversation(id, startWith) },
                    otherwise = { Text("The duel") },
                )
            }
        }
    }

    @Test
    fun startingTheChallengeCallsAtOnceWithTheMicrophoneItAskedFor() {
        show()

        compose.onNodeWithText("Unit challenge").assertExists()
        compose.onNodeWithText("Order at the café").assertExists()
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.Checkpoint(block)), harness.api.starts)
        assertEquals(listOf(false), harness.client.connects)
        assertTrue(harness.transport.microphone)
        harness.transport.onEvent(LiveServerEvent.Started)
        compose.waitForIdle()
        compose.onNodeWithText("Listening…").assertExists()
    }

    @Test
    fun aCallBeingPreparedIsWrittenOnTheTapThenOpensOnItsIntro() {
        harness.api.checkpoint = checkpointStatus("""{"status":"preparing","unitTitle":"At the café"}""")
        show()

        compose.onNodeWithText("At the café").assertExists()
        compose.onNodeWithText("Get the call ready").performClick()
        compose.waitForIdle()

        assertEquals(listOf<CallRequest>(CallRequest.Checkpoint(block)), harness.api.starts)
        compose.onNodeWithText("Start the call").assertExists()
        assertTrue("A prepared call waits for its own Start", harness.client.connects.isEmpty())
    }

    @Test
    fun aReadyCallOpensItsConversation() {
        harness.api.checkpoint = checkpointStatus("""{"status":"ready","conversationId":"${harness.id}"}""")
        show()

        compose.onNodeWithText("Start the call").assertExists()
        assertTrue(harness.api.starts.isEmpty())
    }

    @Test
    fun todaysStudyTimeUsedUpLeadsBackToToday() {
        harness.api.checkpoint = checkpointIntro(dailyLimitReached = true)
        show()

        compose.onNodeWithText("You've reached today's study time. You can make this call in your next session.").assertExists()
        compose.onNodeWithText("Start the call").assertDoesNotExist()
        compose.onNodeWithText("Back to Today").performClick()
        assertEquals(1, today)
    }

    @Test
    fun aStartRefusedForPlusOffersPlus() {
        harness.api.startRefusal = ApiException(ApiError.Unavailable, "PLUS_REQUIRED", 402)
        show()

        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Challenge calls come with Plus. Your plan keeps going without them.").assertExists()
        compose.onNodeWithText("See Plus").performClick()
        assertEquals(listOf<AppRoute>(AppRoute.Subscription), harness.opened)
    }

    @Test
    fun aDayThatMovedOnReadsTheCheckpointAgain() {
        harness.api.startRefusal = ApiException(ApiError.Unavailable, "BLOCK_FINISHED", 409)
        show()
        compose.waitForIdle()
        val reads = harness.api.checkpointReads

        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()

        assertEquals(reads + 1, harness.api.checkpointReads)
    }

    @Test
    fun aCheckpointThatIsntACallShowsItsOwnScreen() {
        harness.api.checkpoint = checkpointStatus("""{"status":"notLanguage"}""")
        show()

        compose.onNodeWithText("The duel").assertExists()
    }

    @Test
    fun earlierBlocksFirstSendsTheLearnerToToday() {
        harness.api.checkpoint = checkpointStatus("""{"status":"earlierFirst","reason":"lessons"}""")
        show()
        compose.waitForIdle()

        assertEquals(1, today)
    }
}
