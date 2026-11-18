package com.zoonk.android.feature.conversation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.feature.livecall.CallReservation
import com.zoonk.android.feature.livecall.LiveServerEvent
import com.zoonk.android.feature.livecall.characterSays
import com.zoonk.android.feature.livecall.learnerSays
import com.zoonk.android.feature.livecall.setup
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ConversationFlowTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val harness = ConversationHarness()
    private val api get() = harness.api
    private val client get() = harness.client
    private val transports get() = harness.transports
    private val transport get() = harness.transport
    private val closed get() = harness.closed

    private fun show() = harness.show(compose)

    private fun goLive() = harness.goLive(compose)

    /** The call's column is a lazy list: what's out of view isn't there until scrolled to. */
    private fun seen(text: String) {
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(text))
    }

    @Test
    fun aLearnerTalksTypesEndsAndReadsTheFeedback() {
        show()

        compose.onNodeWithText("Order at the café").assertExists()
        seen("Ask for a coffee")
        seen("Turn your sound on.")

        goLive()
        assertTrue(transport.microphone)
        compose.onNodeWithText("Calling Lucía…").assertExists()

        transport.onEvent(characterSays("¡Hola! ¿Qué le pongo?"))
        transport.onEvent(learnerSays("Un café, por favor.", 1000.0, 3000.0))
        seen("Lucía: ¡Hola! ¿Qué le pongo?")
        seen("You: Un café, por favor.")

        compose.onNode(hasSetTextAction()).performTextInput("Con leche")
        compose.onNodeWithContentDescription("Send").performClick()
        seen("You: Con leche")
        assertTrue(
            transport.commentary
                .last()
                .content
                .endsWith("\"Con leche\""),
        )

        compose.onNodeWithContentDescription("Help").performClick()
        compose.onNodeWithText("A phrase you can use").assertExists()

        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        val saved = api.completions.single()
        assertEquals(2L, saved.spokenSeconds)
        assertTrue(saved.usedHelp)
        assertEquals("Europe/Madrid", saved.timeZone)
        assertEquals(listOf("¡Hola! ¿Qué le pongo?", "Un café, por favor.", "Con leche"), saved.turns.map { it.text })

        compose.onNodeWithText("Order at the café").assertExists()
        compose.onNodeWithText("You did well.").assertExists()
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("What went well").assertExists()
        compose.onNodeWithText("Continue").performClick()
        compose.onNodeWithText("To improve").assertExists()
        compose.onNodeWithText("Continue").performClick()
        assertEquals(1, closed)
    }

    @Test
    fun endingACallThatHasntConnectedGoesBackToItsIntro() {
        show()
        compose.onNodeWithText("Call Lucía").performClick()
        compose.onNodeWithText("Calling Lucía…").assertExists()

        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Call Lucía").assertExists()
        assertEquals(listOf(com.zoonk.android.feature.livecall.CONNECTION), client.ended)
        assertTrue(transport.closed)
    }

    @Test
    fun aCallOpenElsewhereCanBeTakenOver() {
        client.reservations =
            ArrayDeque(
                listOf(
                    CallReservation.CallInProgress,
                    CallReservation.Ready(
                        com.zoonk.android.feature.livecall
                            .setup(),
                    ),
                ),
            )
        show()
        compose.onNodeWithText("Call Lucía").performClick()

        compose.onNodeWithText("You're in another call").assertExists()
        compose.onNodeWithText("Start this call").performClick()
        compose.waitForIdle()

        assertEquals(listOf(false, true), client.connects)
        compose.onNodeWithText("Calling Lucía…").assertExists()
    }

    @Test
    fun aDroppedCallCalledAgainContinuesWhatWasSaidAndSavesTheWholeCall() {
        client.reservations =
            ArrayDeque(
                listOf(
                    CallReservation.Ready(setup()),
                    CallReservation.Ready(setup(talkSeconds = 150, continuesCall = true, connectionId = SECOND)),
                ),
            )
        show()
        goLive()
        transport.onEvent(characterSays("¡Hola! ¿Qué le pongo?"))
        transport.onEvent(learnerSays("Un café, por favor.", 1000.0, 3000.0))
        compose.onNodeWithContentDescription("Help").performClick()
        transport.onLost()
        compose.waitForIdle()
        compose.onNodeWithText("The call dropped").assertExists()

        compose.onNodeWithText("Call again").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Reconnecting…").assertExists()
        seen("You: Un café, por favor.")
        val earlier = listOf("¡Hola! ¿Qué le pongo?", "Un café, por favor.")
        assertEquals(earlier, client.offeredTurns.last().map { it.text })

        transport.onEvent(LiveServerEvent.Started)
        compose.waitForIdle()
        assertEquals(2, transports.size)
        assertEquals(earlier, client.offeredTurns.last().map { it.text })
        seen("Lucía: ¡Hola! ¿Qué le pongo?")

        transport.onEvent(learnerSays("Con leche", 0.0, 1000.0))
        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        val saved = api.completions.single()
        assertEquals(SECOND, saved.connectionId)
        assertEquals(earlier + "Con leche", saved.turns.map { it.text })
        assertEquals(3L, saved.spokenSeconds)
        assertTrue(saved.usedHelp)
    }

    /** End while a dropped call rings again ends the call, on what was said, as End does on a live call. */
    @Test
    fun endingARingingReconnectEndsTheCallOnWhatWasSaid() {
        client.reservations =
            ArrayDeque(listOf(CallReservation.Ready(setup()), CallReservation.Ready(setup(continuesCall = true, connectionId = SECOND))))
        show()
        goLive()
        transport.onEvent(learnerSays("Un café", 1000.0, 2000.0))
        transport.onLost()
        compose.waitForIdle()
        compose.onNodeWithText("Call again").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Reconnecting…").assertExists()

        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        compose.onNodeWithText("The call dropped").assertDoesNotExist()
        assertEquals(
            listOf("Un café"),
            api.completions
                .single()
                .turns
                .map { it.text },
        )
    }

    /** Back while a dropped call rings again asks first, as on a live call, and ends nothing until the learner confirms. */
    @Test
    fun goingBackFromARingingReconnectAsksBeforeEndingTheCall() {
        client.reservations =
            ArrayDeque(listOf(CallReservation.Ready(setup()), CallReservation.Ready(setup(continuesCall = true, connectionId = SECOND))))
        show()
        goLive()
        transport.onEvent(learnerSays("Un café", 1000.0, 2000.0))
        transport.onLost()
        compose.waitForIdle()
        compose.onNodeWithText("Call again").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Reconnecting…").assertExists()

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()

        compose.onNodeWithText("End the call?").assertExists()
        assertTrue(api.completions.isEmpty())
        compose.onNodeWithText("Keep talking").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Reconnecting…").assertExists()
    }

    /** A first call the server says continues one (its app closed mid-call) has said nothing here: Back goes to its intro. */
    @Test
    fun goingBackFromAFirstCallThatRingsAsAReconnectGoesBackToItsIntro() {
        client.reservations = ArrayDeque(listOf(CallReservation.Ready(setup(continuesCall = true))))
        show()
        compose.onNodeWithText("Call Lucía").performClick()
        compose.waitForIdle()
        compose.onNodeWithText("Reconnecting…").assertExists()

        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()

        compose.onNodeWithText("End the call?").assertDoesNotExist()
        compose.onNodeWithText("Call Lucía").assertExists()
        assertTrue(api.completions.isEmpty())
    }

    @Test
    fun endingADroppedCallSavesWhatWasSaid() {
        show()
        goLive()
        transport.onEvent(learnerSays("Un café", 1000.0, 2000.0))
        transport.onLost()
        compose.waitForIdle()

        compose.onNodeWithText("End the call").performClick()
        compose.waitForIdle()

        assertEquals(
            listOf("Un café"),
            api.completions
                .single()
                .turns
                .map { it.text },
        )
        compose.onNodeWithText("You did well.").assertExists()
    }

    private companion object {
        val SECOND: UUID = UUID.fromString("00000000-0000-4000-8000-000000000002")
    }
}
