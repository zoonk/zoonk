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
import com.zoonk.android.feature.livecall.characterSays
import com.zoonk.android.feature.livecall.learnerSays
import com.zoonk.android.feature.livecall.setup
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

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
        seen("Turn your sound on. The microphone is on only during the call.")

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
        compose.onNodeWithText("Phrases you can use").assertExists()

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

        compose.onNodeWithContentDescription("Cancel").performClick()
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

        compose.onNodeWithText("You're already in a call").assertExists()
        compose.onNodeWithText("End that call and start this one").performClick()
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
                    CallReservation.Ready(setup(talkSeconds = 150, continuesCall = true)),
                    CallReservation.Ready(setup(talkSeconds = 120, continuesCall = true)),
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
        compose.onNodeWithText("Calling Lucía…").assertExists()
        seen("You: Un café, por favor.")
        val earlier = listOf("¡Hola! ¿Qué le pongo?", "Un café, por favor.")
        assertEquals(earlier, client.offeredTurns.last().map { it.text })

        // Cancelling the call back to its intro keeps what was said for the next start.
        compose.onNodeWithContentDescription("Cancel").performClick()
        compose.waitForIdle()
        goLive()
        assertEquals(3, transports.size)
        assertEquals(earlier, client.offeredTurns.last().map { it.text })
        seen("Lucía: ¡Hola! ¿Qué le pongo?")

        transport.onEvent(learnerSays("Con leche", 0.0, 1000.0))
        compose.onNodeWithContentDescription("End").performClick()
        compose.waitForIdle()

        val saved = api.completions.single()
        assertEquals(earlier + "Con leche", saved.turns.map { it.text })
        assertEquals(3L, saved.spokenSeconds)
        assertTrue(saved.usedHelp)
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
}
